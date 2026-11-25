import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Building2, ClipboardList, FlaskConical, Home, Menu, Moon, Shapes, Sun, Users, X } from 'lucide-react'
import clsx from 'clsx'
import { LANGS, useI18n } from '../i18n'

const NAV = [
  { to: '/', key: 'nav.home', icon: Home, end: true },
  { to: '/survey', key: 'nav.survey', icon: ClipboardList },
  { to: '/dorm', key: 'nav.dorm', icon: Building2 },
  { to: '/types', key: 'nav.types', icon: Shapes },
  { to: '/pair', key: 'nav.pair', icon: Users },
  { to: '/lab', key: 'nav.lab', icon: FlaskConical },
]

function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('rm.theme') === 'dark' } catch { return false }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('rm.theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])
  return [dark, setDark]
}

function Logo() {
  return (
    <span className="grid grid-cols-2 gap-[3px] w-8 h-8 p-[5px] rounded-lg bg-ink dark:bg-night-line" aria-hidden>
      <span className="rounded-[3px] bg-sky" /><span className="rounded-[3px] bg-good" />
      <span className="rounded-[3px] bg-sun" /><span className="rounded-[3px] bg-sky" />
    </span>
  )
}

export default function Layout() {
  const { t, lang, setLang } = useI18n()
  const [dark, setDark] = useTheme()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map(({ to, key, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
            isActive ? 'bg-ink text-white dark:bg-sky dark:text-night' : 'text-ink-soft hover:bg-surface dark:text-[#b9bcdc] dark:hover:bg-night-surface')}>
          <Icon size={18} strokeWidth={2} />
          {t(key)}
        </NavLink>
      ))}
    </nav>
  )

  const controls = (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t('lang')} className="flex rounded-xl border border-line dark:border-night-line p-1 bg-surface dark:bg-night-surface">
        {LANGS.map((l) => (
          <button key={l.code} role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)}
            className={clsx('flex-1 rounded-lg py-1.5 text-xs font-semibold',
              lang === l.code ? 'bg-sky-wash text-sky-deep dark:bg-night-line dark:text-sky' : 'muted')}>
            {l.label}
          </button>
        ))}
      </div>
      <button onClick={() => setDark(!dark)} className="btn-ghost w-full text-xs">
        {dark ? <Sun size={15} /> : <Moon size={15} />}{dark ? t('theme.light') : t('theme.dark')}
      </button>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden lg:flex flex-col justify-between sticky top-0 h-screen p-5 border-r border-line dark:border-night-line">
        <div className="space-y-8">
          <NavLink to="/" className="flex items-center gap-3">
            <Logo />
            <span>
              <span className="block font-display font-bold text-[15px] leading-tight">RoomMatch</span>
              <span className="block text-[11px] muted">{t('app.tagline')}</span>
            </span>
          </NavLink>
          {nav}
        </div>
        {controls}
      </aside>

      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-paper/90 dark:bg-night/90 backdrop-blur border-b border-line dark:border-night-line">
        <NavLink to="/" className="flex items-center gap-2"><Logo /><span className="font-display font-bold">RoomMatch</span></NavLink>
        <button className="btn-ghost px-3" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>
      {open && (
        <div className="lg:hidden fixed inset-0 top-14 z-20 bg-paper dark:bg-night p-5 space-y-6 overflow-auto">
          {nav}
          {controls}
        </div>
      )}

      <main className="min-w-0 px-4 sm:px-8 py-8 lg:py-10 max-w-[1320px]">
        <Outlet />
      </main>
    </div>
  )
}
