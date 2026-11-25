import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { api } from '../api'
import { INTEREST_EMOJI, useI18n } from '../i18n'
import { hourStr } from '../lib'
import { ErrorBox, Loader, PersonLine, Reasons, ScorePill } from '../components/ui'

const INITIAL = {
  name: '', gender: 'F', bedtime: 23.5, wake_time: 7.5, cleanliness: 3, noise_tolerance: 3, guests: 3,
  study_in_room: 3, social: 3, smoker: false, language: 'kk', about: '', year: 1, faculty: 'IT',
}

function Scale({ value, onChange, left, right }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2" role="radiogroup">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={clsx('h-16 rounded-xl border-2 font-display text-xl font-bold transition-colors',
              value === v ? 'border-ink bg-ink text-white dark:border-sky dark:bg-sky dark:text-night'
                : 'border-line dark:border-night-line hover:border-sky')}>
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-sm muted mt-2"><span>{left}</span><span>{right}</span></div>
    </div>
  )
}

function Choice({ options, value, onChange }) {
  return (
    <div className="grid sm:grid-cols-3 gap-3" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={clsx('rounded-2xl border-2 p-5 text-left transition-colors',
            value === o.value ? 'border-ink dark:border-sky bg-surface dark:bg-night-surface' : 'border-line dark:border-night-line hover:border-sky')}>
          <span className="text-3xl block mb-2" aria-hidden>{o.icon}</span>
          <span className="font-semibold">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function Clock({ value, onChange, min, max }) {
  const night = value >= 24 || value < 6
  return (
    <div className="text-center">
      <div className="font-display text-6xl font-bold tabular-nums my-6" aria-live="polite">
        <span aria-hidden className="mr-3 text-5xl">{night ? '🌙' : value < 9 ? '🌅' : '☀️'}</span>{hourStr(value)}
      </div>
      <input type="range" min={min} max={max} step="0.5" value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" aria-valuetext={hourStr(value)} />
      <div className="flex justify-between text-sm muted mt-1"><span>{hourStr(min)}</span><span>{hourStr(max)}</span></div>
    </div>
  )
}

function Passport({ data, onMoveIn, moving, placed, onRestart }) {
  const { t, typeName, interest } = useI18n()
  const c = data.cluster
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="panel overflow-hidden">
        <div className="bg-ink text-white dark:bg-night-line p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:items-center">
          <span className="text-7xl" aria-hidden>{c.emoji}</span>
          <div className="flex-1">
            <p className="text-sm text-white/70">{t('survey.passport')}: {data.student.name}</p>
            <h2 className="text-3xl font-bold mt-1">{typeName(c)}</h2>
            <p className="mt-2 text-white/80 max-w-lg">{t(`type.${c.key}.d`)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line dark:bg-night-line">
          {[
            [t('f.bedtime'), data.student.bedtime_str], [t('f.wake_time'), data.student.wake_time_str],
            [t('f.cleanliness'), `${data.student.cleanliness}/5`], [t('f.social'), `${data.student.social}/5`],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface dark:bg-night-surface p-4">
              <dt className="text-xs muted">{k}</dt><dd className="font-display font-bold text-lg mt-1">{v}</dd>
            </div>
          ))}
        </dl>
        {data.student.interests?.length > 0 && (
          <div className="p-4 flex flex-wrap gap-2 border-t border-line dark:border-night-line">
            {data.student.interests.map((i) => (
              <span key={i} className="rounded-full bg-sky-wash text-sky-deep dark:bg-night-line dark:text-sky px-3 py-1 text-sm">
                {INTEREST_EMOJI[i]} {interest(i)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="panel p-6">
        <h3 className="font-sans font-semibold mb-4 tracking-normal">{t('survey.matches')}</h3>
        <ul className="divide-y divide-line dark:divide-night-line">
          {data.top_matches.map((p) => (
            <li key={p.id} className="py-3 grid sm:grid-cols-[minmax(0,240px)_1fr] gap-3">
              <PersonLine person={p} right={<ScorePill score={p.score} />} />
              <Reasons reasons={p.reasons} />
            </li>
          ))}
        </ul>
      </div>

      {placed ? (
        <div className="panel p-6 bg-good-wash dark:bg-night-surface border-good/40 flex flex-wrap items-center gap-4 justify-between" role="status">
          <p className="font-medium">{t('survey.moved', { room: placed.placed.room, score: Math.round(placed.placed.score) })}</p>
          <div className="flex gap-2">
            <Link className="btn-primary" to={`/student/${placed.id}`}>{t('survey.seeRoom')}</Link>
            <button className="btn-ghost" onClick={onRestart}>{t('survey.again')}</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button className="btn-primary px-6 py-3" onClick={onMoveIn} disabled={moving}>{moving ? t('common.running') : t('survey.moveIn')}</button>
          <button className="btn-ghost px-6 py-3" onClick={onRestart}>{t('survey.again')}</button>
        </div>
      )}
    </motion.div>
  )
}

export default function Survey() {
  const { t, interest } = useI18n()
  const [form, setForm] = useState(INITIAL)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [placed, setPlaced] = useState(null)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const steps = [
    { q: t('survey.name'), body: <input autoFocus className="field text-lg py-3" value={form.name} placeholder={t('survey.namePh')} onChange={(e) => set('name')(e.target.value)} maxLength={40} /> },
    { q: t('survey.gender'), body: <Choice value={form.gender} onChange={set('gender')} options={[{ value: 'F', label: t('common.female'), icon: '🚺' }, { value: 'M', label: t('common.male'), icon: '🚹' }]} /> },
    { q: t('survey.bedtime'), body: <Clock value={form.bedtime} onChange={set('bedtime')} min={21} max={27} /> },
    { q: t('survey.wake'), body: <Clock value={form.wake_time} onChange={set('wake_time')} min={5} max={12} /> },
    { q: t('survey.clean'), body: <Scale value={form.cleanliness} onChange={set('cleanliness')} left={t('survey.clean.1')} right={t('survey.clean.5')} /> },
    { q: t('survey.noise'), body: <Scale value={form.noise_tolerance} onChange={set('noise_tolerance')} left={t('survey.noise.1')} right={t('survey.noise.5')} /> },
    { q: t('survey.guests'), body: <Scale value={form.guests} onChange={set('guests')} left={t('survey.guests.1')} right={t('survey.guests.5')} /> },
    { q: t('survey.study'), body: <Scale value={form.study_in_room} onChange={set('study_in_room')} left={t('survey.study.1')} right={t('survey.study.5')} /> },
    { q: t('survey.social'), body: <Scale value={form.social} onChange={set('social')} left={t('survey.social.1')} right={t('survey.social.5')} /> },
    { q: t('survey.smoke'), body: <Choice value={form.smoker} onChange={set('smoker')} options={[{ value: false, label: t('survey.no'), icon: '🌬️' }, { value: true, label: t('survey.yes'), icon: '🚬' }]} /> },
    { q: t('survey.lang'), body: <Choice value={form.language} onChange={set('language')} options={[{ value: 'kk', label: 'Қазақша', icon: '🇰🇿' }, { value: 'ru', label: 'Русский', icon: '💬' }, { value: 'en', label: 'English', icon: '🌐' }]} /> },
    {
      q: t('survey.about'), body: (
        <div className="space-y-3">
          <p className="text-sm muted">{t('survey.aboutHint')}</p>
          <textarea className="field min-h-28 text-base" value={form.about} placeholder={t('survey.aboutPh')} onChange={(e) => set('about')(e.target.value)} maxLength={300} />
          <div className="flex flex-wrap gap-2">
            {Object.keys(INTEREST_EMOJI).map((k) => (
              <button key={k} type="button" className="rounded-full border border-line dark:border-night-line px-3 py-1 text-sm hover:border-sky"
                onClick={() => set('about')(`${form.about}${form.about && !form.about.endsWith(' ') ? ', ' : ''}${interest(k)}`)}>
                {INTEREST_EMOJI[k]} {interest(k)}
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ]
  const last = step === steps.length - 1
  const payload = () => ({ ...form, name: form.name.trim() || 'Guest' })

  async function next() {
    if (!last) { setStep(step + 1); return }
    setLoading(true); setError(null)
    try { setResult(await api.previewSurvey(payload())) } catch (e) { setError(e) } finally { setLoading(false) }
  }
  async function moveIn() {
    setLoading(true)
    try { setPlaced(await api.submitSurvey(payload())) } catch (e) { setError(e) } finally { setLoading(false) }
  }
  function restart() { setForm(INITIAL); setStep(0); setResult(null); setPlaced(null); setError(null) }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-8">{t('survey.title')}</h1>
      {error && <div className="mb-6"><ErrorBox error={error} /></div>}
      {result ? (
        <Passport data={result} onMoveIn={moveIn} moving={loading} placed={placed} onRestart={restart} />
      ) : (
        <div className="panel p-6 sm:p-10">
          <div className="flex items-center justify-between text-sm muted mb-3">
            <span>{t('survey.step', { i: step + 1, n: steps.length })}</span>
          </div>
          <div className="h-1.5 rounded-full bg-line dark:bg-night-line overflow-hidden mb-8" aria-hidden>
            <div className="h-full bg-sky rounded-full transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); next() }}>
            <AnimatePresence mode="wait">
              <motion.fieldset key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
                <legend className="font-display text-xl sm:text-2xl font-bold mb-6">{steps[step].q}</legend>
                {steps[step].body}
              </motion.fieldset>
            </AnimatePresence>
            <div className="flex justify-between mt-10">
              <button type="button" className="btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>{t('survey.back')}</button>
              <button type="submit" className="btn-primary px-6" disabled={loading}>
                {loading ? t('common.running') : last ? t('survey.finish') : t('survey.next')}
              </button>
            </div>
          </form>
          {loading && <Loader />}
        </div>
      )}
    </div>
  )
}
