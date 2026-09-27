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
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
const ADMIN = { id: '00000000-0000-4000-8000-000000000002', full_name: 'Smoke Admin', email: '' }

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
]

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ---- Fake Supabase --------------------------------------------------------

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range',
}

const mock = createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { ...cors, 'Content-Type': 'application/json', 'Content-Range': '*/0' })
    res.end(body === undefined ? '' : JSON.stringify(body))
  }
  const url = new URL(req.url, 'http://mock')
  if (req.method === 'OPTIONS') return send(204)
  if (!url.pathname.startsWith('/rest/v1/')) return send(404, { message: 'not mocked' })

  const name = url.pathname.slice('/rest/v1/'.length)
  if (name === 'rpc/member_session') return send(200, MEMBER)
  if (name === 'rpc/admin_session') return send(200, ADMIN)
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
  await browser.send('Page.reload')
  await sleep(3500)
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

  if (!text.trim()) errors.push('blank screen (nothing rendered)')
  else if (!text.includes(screen.expect)) errors.push(`expected to see "${screen.expect}" but did not`)
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
    for (const clock of screen.eachClock ? CLOCKS : [CLOCKS[0]]) {
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
