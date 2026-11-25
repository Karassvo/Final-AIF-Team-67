import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import clsx from 'clsx'
import { useI18n } from '../i18n'
import { scoreColor, initials, TYPE_COLORS, fmt } from '../lib'

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    return run()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }))
  }, [run])
  useEffect(() => { reload() }, [reload])
  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) }
}

export function Loader({ label }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3 py-16 justify-center muted" role="status">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="w-3 h-3 rounded-[3px] bg-sky animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
      {label || t('common.loading')}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  const { t } = useI18n()
  const offline = error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError') || error?.message?.includes('Bad Gateway')
  return (
    <div className="panel p-6 flex gap-4 items-start border-bad/40" role="alert">
      <AlertTriangle className="text-bad shrink-0" />
      <div className="space-y-3">
        <p className="font-medium">{offline ? t('err.backend') : error?.message}</p>
        {onRetry && <button className="btn-ghost" onClick={onRetry}>{t('common.retry')}</button>}
      </div>
    </div>
  )
}

export function PageHeader({ title, lead, children }) {
  return (
    <header className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between mb-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        {lead && <p className="muted mt-2 leading-relaxed">{lead}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 items-center">{children}</div>}
    </header>
  )
}

export function ScoreRing({ score, size = 96, stroke = 9, label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, score ?? 0))
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-line dark:text-night-line" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreColor(v)} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: 'stroke-dashoffset 700ms ease, stroke 700ms ease' }} />
      </svg>
      <div className="absolute text-center leading-none">
        <div className="font-display font-bold" style={{ fontSize: size * 0.27 }}>{fmt(score)}</div>
        {label && <div className="text-[10px] muted mt-1">{label}</div>}
      </div>
    </div>
  )
}

export function ScorePill({ score, className }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums', className)}
      style={{ background: scoreColor(score, 0.15), color: scoreColor(score) }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: scoreColor(score) }} />
      {fmt(score)}
    </span>
  )
}

export function Avatar({ person, size = 36 }) {
  const color = TYPE_COLORS[(person.cluster?.id ?? 0) % TYPE_COLORS.length]
  return (
    <span className="relative inline-grid place-items-center rounded-full font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }} aria-hidden>
      {initials(person.name)}
      {person.cluster?.emoji && (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-surface dark:bg-night-surface leading-none p-[2px]"
          style={{ fontSize: size * 0.36 }}>{person.cluster.emoji}</span>
      )}
    </span>
  )
}

export function PersonLine({ person, right, onClick }) {
  const { t, typeName } = useI18n()
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className={clsx('flex items-center gap-3 w-full text-left', onClick && 'rounded-xl -mx-2 px-2 py-1.5 hover:bg-paper dark:hover:bg-night')}>
      <Avatar person={person} />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{person.name}</div>
        <div className="text-xs muted truncate">
          {typeName(person.cluster)}{person.faculty ? `, ${person.faculty}` : ''}{person.year ? `, ${t('common.year', { n: person.year })}` : ''}
        </div>
      </div>
      {right}
    </Comp>
  )
}

export function Reasons({ reasons, limit }) {
  const { t, interest } = useI18n()
  const list = limit ? reasons.slice(0, limit) : reasons
  return (
    <ul className="space-y-1.5">
      {list.map((r, i) => {
        const vars = { a: r.a, b: r.b, lang: r.lang ? t(`lang.${r.lang}`) : '', x: t('r.social_close.x'),
          items: (r.items || []).map(interest).join(', ') }
        return (
          <li key={i} className="flex gap-2 text-sm leading-snug">
            {r.type === 'good'
              ? <Check size={16} className="text-good shrink-0 mt-0.5" aria-label="+" />
              : <X size={16} className="text-bad shrink-0 mt-0.5" aria-label="−" />}
            <span>{t(`r.${r.key}`, vars)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function Kpi({ label, value, unit, tone, hint }) {
  return (
    <div className="min-w-0">
      <div className="text-xs muted mb-1">{label}</div>
      <div className={clsx('font-display text-2xl font-bold tabular-nums', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>
        {value}{unit && <span className="text-base font-medium muted ml-0.5">{unit}</span>}
      </div>
      {hint && <div className="text-xs muted mt-0.5">{hint}</div>}
    </div>
  )
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line dark:border-night-line p-1 bg-surface dark:bg-night-surface">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={clsx('px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
            value === o.value ? 'bg-ink text-white dark:bg-sky dark:text-night' : 'muted hover:text-ink dark:hover:text-white')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StudentPicker({ students, value, onChange, label }) {
  const { typeName } = useI18n()
  return (
    <label className="block">
      <span className="block text-xs muted">{label}</span>
      <select className="field mt-1" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))}>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.cluster.emoji} {s.name}, {typeName(s.cluster)}, {s.gender === 'F' ? '♀' : '♂'} #{s.id}
          </option>
        ))}
      </select>
    </label>
  )
}
