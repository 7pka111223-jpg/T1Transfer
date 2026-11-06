import type { ComponentType } from 'react'
import './glass-tab-bar.css'

export type GlassTab<T extends string> = {
  id: T
  label: string
  icon: ComponentType<{ className?: string }>
  /** Tabs that count as this one being active (e.g. sub-pages). Defaults to [id]. */
  group?: readonly T[]
  badge?: number
}

/**
 * Floating liquid-glass bottom bar. Tabs share the width equally and a glass
 * lens slides to whichever tab is active. Add `glass-bar-spacer` to the page
 * so its last content can scroll clear of the bar.
 */
export function GlassTabBar<T extends string>({ tabs, active, onSelect, label = 'Main' }: {
  tabs: GlassTab<T>[]
  active: T
  onSelect: (id: T) => void
  label?: string
}) {
  const index = tabs.findIndex(t => (t.group ?? [t.id]).includes(active))
  return (
    <nav className="glass-bar" aria-label={label}>
      <div className="glass-bar__track" role="tablist" style={{ ['--glass-count' as string]: tabs.length, ['--glass-index' as string]: Math.max(0, index) }}>
        <span className={`glass-bar__lens${index < 0 ? ' glass-bar__lens--hidden' : ''}`} aria-hidden="true" />
        {tabs.map((tab, i) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className="glass-bar__tab"
              onClick={() => onSelect(tab.id)}
            >
              <Icon />
              <span className="glass-bar__label">{tab.label}</span>
              {!!tab.badge && (
                <span className="glass-bar__badge" aria-label={`${tab.badge} new`}>
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
