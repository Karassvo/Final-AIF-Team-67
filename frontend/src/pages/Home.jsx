import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useI18n } from '../i18n'
import { fmt } from '../lib'
import { FloorPlan, ScoreLegend } from '../components/FloorPlan'
import { ErrorBox, Kpi, Loader, useAsync } from '../components/ui'

const STEPS = [
  { key: 's1', algo: null },
  { key: 's2', algo: 'Fuzzy logic' },
  { key: 's3', algo: 'K-means++, TF-IDF' },
  { key: 's4', algo: 'CSP, simulated annealing' },
  { key: 's5', algo: 'Decision tree, genetic algorithm' },
]

function LiveDorm({ dorm }) {
  const { t } = useI18n()
  const frames = dorm.frames || []
  const [i, setI] = useState(0)
  useEffect(() => {
    if (frames.length < 2) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setI(frames.length - 1); return }
    const id = setInterval(() => setI((x) => (x + 1) % (frames.length + 12)), 140)
    return () => clearInterval(id)
  }, [frames.length])
  const frame = frames.length ? frames[Math.min(i, frames.length - 1)] : null
  const progress = frames.length ? Math.min(i, frames.length - 1) / (frames.length - 1) : 1
  return (
    <figure className="panel p-4 sm:p-5">
      <FloorPlan floors={dorm.floors} frameScores={frame} compact />
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs muted flex items-center gap-2">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-good animate-ping opacity-60" />
            <span className="relative w-2 h-2 rounded-full bg-good" />
          </span>
          {t('home.liveCaption')}
        </span>
        <ScoreLegend />
      </figcaption>
      <div className="mt-3 h-1 rounded-full bg-line dark:bg-night-line overflow-hidden" aria-hidden>
        <div className="h-full bg-sky" style={{ width: `${progress * 100}%`, transition: 'width 140ms linear' }} />
      </div>
    </figure>
  )
}

export default function Home() {
  const { t } = useI18n()
  const dorm = useAsync(() => api.dorm(), [])
  const summary = useAsync(() => api.summary(), [])
  const m = summary.data?.metrics

  return (
    <div className="space-y-16">
      <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-10 items-center">
        <div>
          <h1 className="font-display font-bold text-[2rem] sm:text-[2.6rem] leading-[1.08] tracking-tight">{t('home.title')}</h1>
          <p className="mt-5 text-lg leading-relaxed muted max-w-xl">{t('home.lead')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/survey" className="btn-primary px-5 py-3 text-base">{t('home.ctaSurvey')}</Link>
            <Link to="/dorm" className="btn-ghost px-5 py-3 text-base">{t('home.ctaDorm')}</Link>
          </div>
        </div>
        {dorm.loading && <Loader />}
        {dorm.error && <ErrorBox error={dorm.error} onRetry={dorm.reload} />}
        {dorm.data && <LiveDorm dorm={dorm.data} />}
      </section>

      {m && (
        <section aria-labelledby="now">
          <h2 id="now" className="text-lg font-bold mb-4">{t('home.now')}</h2>
          <div className="panel p-6 grid grid-cols-2 md:grid-cols-5 gap-6">
            <Kpi label={t('kpi.students')} value={summary.data.n_students} hint={`${summary.data.n_rooms} ${t('common.rooms')}, ${summary.data.beds} ${t('common.beds')}`} />
            <Kpi label={t('kpi.mean')} value={fmt(m.mean_score)} unit="/100" />
            <Kpi label={t('kpi.worst')} value={fmt(m.worst10_score)} unit="/100" />
            <Kpi label={t('kpi.conflict')} value={fmt(m.conflict_rate, 1)} unit="%" tone={m.conflict_rate < 3 ? 'good' : 'bad'} />
            {m.true_mean != null && <Kpi label={t('kpi.real')} value={fmt(m.true_mean)} unit="/100" />}
          </div>
        </section>
      )}

      <section aria-labelledby="how">
        <h2 id="how" className="text-lg font-bold mb-6">{t('home.how')}</h2>
        <ol className="grid md:grid-cols-5 gap-px bg-line dark:bg-night-line rounded-2xl overflow-hidden border border-line dark:border-night-line">
          {STEPS.map((s, i) => (
            <li key={s.key} className="bg-surface dark:bg-night-surface p-5 flex flex-col gap-3">
              <span className="font-display text-3xl font-bold text-sky/80">{i + 1}</span>
              <h3 className="font-sans font-semibold text-base tracking-normal">{t(`home.${s.key}.t`)}</h3>
              <p className="text-sm muted leading-relaxed flex-1">{t(`home.${s.key}.d`)}</p>
              <span className="text-xs font-medium text-sky-deep dark:text-sky">{s.algo ?? 'Қаз, Рус, Eng'}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
