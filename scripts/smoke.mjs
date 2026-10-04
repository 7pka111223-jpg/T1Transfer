// Smoke test: build the app against a fake Supabase, open every screen in a
// headless Chrome/Edge at several gym clock times, and fail if any screen
// throws or does not render. Catches crashes that tsc and `vite build` miss,
// like a module-level throw that only happens outside check-in hours.
//
//   npm run smoke          (or `npm run check` for tsc + build + smoke)
//
// Needs Node 22+ (built-in WebSocket) and Chrome or Edge. Set CHROME_PATH to
// use a specific browser. Touches no real data: the fake Supabase below
// answers every request locally.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build, preview } from 'vite'

const OUT_DIR = '.smoke-dist'
const MOCK_PORT = 54399
const APP_PORT = 4199

const MEMBER = {
  id: '00000000-0000-4000-8000-000000000001', member_id: 'T0001', full_name: 'Smoke Member',
  phone: '01000000000', email: null, date_of_birth: null, gender: null, status: 'active',
  level: 'Warrior', profile_image_url: null, medical_notes: null, emergency_contact: null,
  loyalty_points: 0, branch_id: null,
}
const ADMIN = { id: '00000000-0000-4000-8000-000000000002', full_name: 'Smoke Admin', email: '', role: 'admin' }
const COACH = { id: '00000000-0000-4000-8000-000000000003', full_name: 'Smoke Coach', email: '', role: 'coach' }
const STAFF_SCHEDULE = [
  { ...ADMIN, username: 'smoke-admin', schedule: { 2: '18:00' } },
  { ...COACH, username: 'smoke-coach', schedule: { 1: '17:00', 3: '19:30' } },
]
// A report with every status the Coaches screen can show.
const COACH_REPORT = ['present', 'override', 'missed', 'open', 'upcoming'].map((status, i) => ({
  admin_id: COACH.id, full_name: COACH.full_name, gym_date: `2026-10-0${i + 1}`, session_time: '18:00', status,
  checked_in_at: status === 'present' || status === 'override' ? '2026-10-01T14:20:00Z' : null,
  distance_m: status === 'present' ? 120 : null, location: status === 'present' ? 'CFC' : null, note: status === 'override' ? 'Traffic' : null,
  override_by_name: status === 'override' ? ADMIN.full_name : null,
}))
// Window open at the pinned Tue 18:30 clock: session 19:00, check in 18:00-18:50.
const COACH_TODAY_OPEN = {
  scheduled: true, session_time: '19:00', session_at: '2026-10-06T16:00:00Z', opens_at: '2026-10-06T15:00:00Z',
  closes_at: '2026-10-06T15:50:00Z', checked_in: false, checked_in_at: null, status: null, location: null,
}
// Coach checked in already today, so the card renders the same at any clock.
const COACH_TODAY = {
  scheduled: true, session_time: '18:00', session_at: '2026-10-06T15:00:00Z', opens_at: '2026-10-06T14:00:00Z',
  closes_at: '2026-10-06T14:50:00Z', checked_in: true, checked_in_at: '2026-10-06T14:20:00Z', status: 'present',
  location: 'CFC',
}

// Gym-local (Cairo, UTC+3 in summer / UTC+2 in winter) moments the app must
// survive. Dates in October 2026 are UTC+3; 2026-10-02 is a Friday.
const CLOCKS = [
  { label: 'Tue 10:00 (check-in closed)', iso: '2026-10-06T07:00:00Z' },
  { label: 'Tue 18:30 (check-in open)', iso: '2026-10-06T15:30:00Z' },
  { label: 'Fri 19:00 (closed all day)', iso: '2026-10-02T16:00:00Z' },
  { label: 'Mon 23:30 (after hours)', iso: '2026-10-05T20:30:00Z' },
]

const SCREENS = [
  { name: 'landing', storage: {}, expect: 'TRIPLE ONE' },
  // Only reachable from the landing page's button, so click through to it.
  { name: 'assessment booking', storage: {}, click: 'Book Free Assessment', expect: 'Select your preferred branch' },
  {
    name: 'member dashboard',
    storage: { t1_member: { ...MEMBER, session_token: 'smoke-member' }, t1_view: 'member-dashboard' },
    expect: MEMBER.full_name, eachClock: true,
  },
  {
    name: 'admin dashboard',
    storage: { t1_admin: { ...ADMIN, session_token: 'smoke-admin' }, t1_view: 'admin-dashboard' },
    expect: ADMIN.full_name, eachClock: true,
  },
  {
    name: 'admin coaches tab',
    storage: { t1_admin: { ...ADMIN, session_token: 'smoke-admin' }, t1_view: 'admin-dashboard', adminActiveTab: 'coaches' },
    expect: ['Coach attendance', 'Weekly session times', 'Marked present', 'Missed', 'N/A', 'CFC (120 m away)'],
  },
  {
    name: 'coach attendance CSV export',
    storage: { t1_admin: { ...ADMIN, session_token: 'smoke-admin' }, t1_view: 'admin-dashboard', adminActiveTab: 'coaches' },
    click: 'Export CSV', expect: 'Exported 2 check-ins',
    download: [
      'Check-ins', 'Date,Weekday,Staff,Role,Session time,Checked in at,Location,Recorded by,Distance from branch (m)',
      ',CFC,Self (location check-in),120,', `Marked present by ${ADMIN.full_name}`, 'Traffic',
      'Totals', 'Staff,Role,Scheduled days,Attended days,Missed days', `${COACH.full_name},coach,5,2,1`,
    ],
  },
  {
    name: 'coach dashboard',
    storage: { t1_admin: { ...COACH, session_token: 'smoke-coach' }, t1_view: 'admin-dashboard', adminActiveTab: 'members' },
    expect: ['Coach Panel', 'My attendance', 'Classes', 'at CFC'], forbid: ['Members & Subscriptions', 'Coach attendance'], eachClock: true,
  },
  {
    // Window open at Tue 18:30 (session 19:00): tap "Check in now" with the
    // device placed at the gym.
    name: 'coach check-in button',
    storage: { t1_admin: { ...COACH, session_token: 'smoke-coach-open' }, t1_view: 'admin-dashboard' },
    clock: 1, geo: { latitude: 30.0478, longitude: 31.4956, accuracy: 15 },
    click: 'Check in now', expect: 'at 1st Settlement (12 m away)',
  },
  {
    name: 'coach before check-in window',
    storage: { t1_admin: { ...COACH, session_token: 'smoke-coach-open' }, t1_view: 'admin-dashboard' },
    clock: 0, expect: 'Check-in opens at 6:00 PM', forbid: 'Check in now',
  },
  {
    // Page left open from 17:59:45: the button must open by itself at 18:00.
    name: 'coach button opens while waiting',
    storage: { t1_admin: { ...COACH, session_token: 'smoke-coach-open' }, t1_view: 'admin-dashboard' },
    at: { label: 'Tue 17:59:45, then wait', iso: '2026-10-06T14:59:45Z' }, waitMs: 20000, expect: 'Check in now',
  },
  {
    name: 'coach with no session today',
    storage: { t1_admin: { ...COACH, session_token: 'smoke-coach-off' }, t1_view: 'admin-dashboard' },
    expect: ['Coach Panel', 'No session for you today'],
  },
]

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ---- Fake Supabase --------------------------------------------------------

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range',
}

const mock = createServer(async (req, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  let body = {}
  try { body = raw ? JSON.parse(raw) : {} } catch {}

  const send = (status, body) => {
    res.writeHead(status, { ...cors, 'Content-Type': 'application/json', 'Content-Range': '*/0' })
    res.end(body === undefined ? '' : JSON.stringify(body))
  }
  const url = new URL(req.url, 'http://mock')
  if (req.method === 'OPTIONS') return send(204)
  if (!url.pathname.startsWith('/rest/v1/')) return send(404, { message: 'not mocked' })

  const name = url.pathname.slice('/rest/v1/'.length)
  if (name === 'rpc/member_session') return send(200, MEMBER)
  if (name === 'rpc/admin_session') return send(200, String(body.p_token).startsWith('smoke-coach') ? COACH : ADMIN)
  if (name === 'rpc/coach_today') {
    if (body.p_token === 'smoke-coach') return send(200, COACH_TODAY)
    if (body.p_token === 'smoke-coach-open') return send(200, COACH_TODAY_OPEN)
    return send(200, { scheduled: false })
  }
  if (name === 'rpc/coach_check_in') {
    const atGym = Math.abs(body.p_lat - 30.047806) < 0.004 && Math.abs(body.p_lng - 31.495639) < 0.004
    return send(200, atGym ? { ok: true, checked_in_at: '2026-10-06T15:30:00Z', distance_m: 12, location: '1st Settlement' }
      : { error: 'too_far', distance_m: 9999, location: 'CFC', radius_m: 500 })
  }
  if (name === 'rpc/coach_schedule_list') return send(200, body.p_token === 'smoke-admin' ? STAFF_SCHEDULE : { error: 'not_admin' })
  if (name === 'rpc/coach_attendance_report') return send(200, body.p_token === 'smoke-admin' ? COACH_REPORT : { error: 'not_admin' })
  if (name.startsWith('rpc/')) return send(200, null)
  if (req.method === 'HEAD') return send(200)
  if (req.method !== 'GET') return send(201, [])

  // .single()/.maybeSingle() ask for one object; answer "no rows" except for
  // the member's own row, like PostgREST does.
  if ((req.headers.accept || '').includes('vnd.pgrst.object')) {
    if (name === 'members') return send(200, MEMBER)
    return send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })
  }
  return send(200, [])
})

// ---- Headless browser over the DevTools protocol --------------------------

const findBrowser = () => {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ].filter(Boolean)
  const found = candidates.find(p => existsSync(p))
  if (!found) throw new Error('No Chrome or Edge found. Set CHROME_PATH to a Chromium-based browser.')
  return found
}

const launchBrowser = async () => {
  const profile = mkdtempSync(path.join(tmpdir(), 't1-smoke-'))
  const proc = spawn(findBrowser(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore' })

  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 80 && !existsSync(portFile); i++) await sleep(100)
  const port = readFileSync(portFile, 'utf8').split('\n')[0]
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })

  let nextId = 0
  const pending = new Map()
  const listeners = new Set()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    else listeners.forEach(fn => fn(msg))
  }
  const send = (method, params = {}) => new Promise(resolve => {
    const id = ++nextId
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
  const close = () => {
    ws.close()
    proc.kill()
    // The browser can hold the profile briefly after exit.
    setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }) } catch {} }, 500)
  }
  return { send, listeners, close }
}

// Freeze the page clock at `iso` (still ticking forward from there).
const clockScript = (iso) => `(() => {
  const offset = new Date(${JSON.stringify(iso)}).getTime() - Date.now();
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [RealDate.now() + offset])); }
    static now() { return RealDate.now() + offset; }
  }
  globalThis.Date = FakeDate;
})()`

const openScreen = async (browser, appUrl, screen, clock) => {
  // Start from a blank page so a late error from the previous screen is not
  // blamed on this one.
  await browser.send('Page.navigate', { url: 'about:blank' })
  await sleep(300)

  const errors = []
  const onEvent = (msg) => {
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      errors.push((d.exception?.description || d.text || 'exception').split('\n').slice(0, 3).join(' | '))
    }
  }

  const { identifier } = (await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: clockScript(clock.iso) })).result
  await browser.send('Page.navigate', { url: appUrl })
  await sleep(800)
  const storage = Object.entries(screen.storage)
    .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(typeof v === 'string' ? v : JSON.stringify(v))});`)
    .join('')
  await browser.send('Runtime.evaluate', { expression: `localStorage.clear();${storage}` })
  browser.listeners.add(onEvent)
  let downloadDir = null
  if (screen.download) {
    downloadDir = mkdtempSync(path.join(tmpdir(), 't1-smoke-dl-'))
    await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir })
  }
  if (screen.geo) {
    await browser.send('Browser.grantPermissions', { permissions: ['geolocation'], origin: new URL(appUrl).origin })
    await browser.send('Emulation.setGeolocationOverride', screen.geo)
  }
  await browser.send('Page.reload')
  await sleep(3500 + (screen.waitMs ?? 0))
  if (screen.click) {
    await browser.send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('button')].find(b => b.innerText.includes(${JSON.stringify(screen.click)}))?.click()`,
    })
    await sleep(2000)
  }

  const { result } = await browser.send('Runtime.evaluate', {
    expression: `document.getElementById('root')?.innerText ?? ''`, returnByValue: true,
  })
  const text = result.result.value || ''
  browser.listeners.delete(onEvent)
  // Leave nothing behind for the next screen's first load.
  await browser.send('Runtime.evaluate', { expression: 'localStorage.clear()' })
  await browser.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })

  if (downloadDir) {
    const files = readdirSync(downloadDir).filter(f => !f.endsWith('.crdownload'))
    if (files.length !== 1) errors.push(`expected one downloaded file, got ${files.length}`)
    else {
      const csv = readFileSync(path.join(downloadDir, files[0]), 'utf8')
      for (const want of screen.download) {
        if (!csv.includes(want)) errors.push(`download ${files[0]} is missing "${want}"`)
      }
    }
    rmSync(downloadDir, { recursive: true, force: true })
  }

  if (!text.trim()) errors.push('blank screen (nothing rendered)')
  else {
    for (const want of [].concat(screen.expect)) {
      if (!text.includes(want)) errors.push(`expected to see "${want}" but did not`)
    }
    for (const unwanted of [].concat(screen.forbid ?? [])) {
      if (text.includes(unwanted)) errors.push(`should not show "${unwanted}"`)
    }
  }
  return errors
}

// ---- Run ------------------------------------------------------------------

if (typeof WebSocket === 'undefined') {
  console.error('Smoke test needs Node 22+ (built-in WebSocket).')
  process.exit(1)
}

console.log('Building app against the fake Supabase...')
process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${MOCK_PORT}`
process.env.VITE_SUPABASE_ANON_KEY = 'smoke-test-anon-key'
await build({ logLevel: 'error', build: { outDir: OUT_DIR, emptyOutDir: true } })

await new Promise(r => mock.listen(MOCK_PORT, '127.0.0.1', r))
const server = await preview({ logLevel: 'error', build: { outDir: OUT_DIR }, preview: { port: APP_PORT, strictPort: true, host: '127.0.0.1' } })
const appUrl = `http://127.0.0.1:${APP_PORT}/`
const browser = await launchBrowser()
await browser.send('Runtime.enable')
await browser.send('Page.enable')

let failures = 0
try {
  for (const screen of SCREENS) {
    for (const clock of screen.eachClock ? CLOCKS : [screen.at ?? CLOCKS[screen.clock ?? 0]]) {
      const errors = await openScreen(browser, appUrl, screen, clock)
      const label = `${screen.name} @ ${clock.label}`
      if (errors.length) {
        failures++
        console.log(`FAIL  ${label}`)
        errors.forEach(e => console.log(`        ${e}`))
      } else {
        console.log(`ok    ${label}`)
      }
    }
  }
} finally {
  browser.close()
  await new Promise(r => server.httpServer.close(r))
  mock.close()
  rmSync(OUT_DIR, { recursive: true, force: true })
}

console.log(failures ? `\n${failures} screen(s) failed.` : '\nAll screens rendered without errors.')
process.exit(failures ? 1 : 0)
