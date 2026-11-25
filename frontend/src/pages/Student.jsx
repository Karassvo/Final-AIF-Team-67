import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftRight, Building2 } from 'lucide-react'
import { api } from '../api'
import { INTEREST_EMOJI, useI18n } from '../i18n'
import { fmt } from '../lib'
import { Avatar, ErrorBox, Loader, PersonLine, Reasons, ScorePill, ScoreRing, useAsync } from '../components/ui'

export default function StudentPage() {
  const { id } = useParams()
  const { t, typeName, interest } = useI18n()
  const data = useAsync(() => api.student(id), [id])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  async function swap(other) {
    setBusy(true)
    try {
      const d = await api.swap(Number(id), other)
      data.setData(d)
      setNotice(t('student.swapped', { id: d.room.id }))
    } catch (e) { setNotice(e.message) } finally { setBusy(false) }
  }

  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />
  if (!data.data) return <Loader />
  const d = data.data
  const s = d.student
  const habits = [
    ['bedtime', s.bedtime_str], ['wake_time', s.wake_time_str], ['cleanliness', `${s.cleanliness}/5`],
    ['noise_tolerance', `${s.noise_tolerance}/5`], ['guests', `${s.guests}/5`], ['study_in_room', `${s.study_in_room}/5`], ['social', `${s.social}/5`],
  ]

  return (
    <div className="space-y-6">
      <section className="panel p-6 flex flex-col md:flex-row gap-6 md:items-center">
        <Avatar person={{ name: s.name, cluster: d.cluster }} size={72} />
        <div className="flex-1 min-w-0">
          <p className="text-xs muted">{t('student.title')} #{s.id}</p>
          <h1 className="text-2xl font-bold">{s.name}</h1>
          <p className="muted mt-1">{d.cluster.emoji} {typeName(d.cluster)}, {s.faculty}, {t('common.year', { n: s.year })}, {t(`lang.${s.language}`)}</p>
          {s.about && <p className="mt-3 text-sm italic max-w-xl">“{s.about}”</p>}
          {s.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {s.interests.map((i) => <span key={i} className="rounded-full bg-sky-wash text-sky-deep dark:bg-night-line dark:text-sky px-2.5 py-0.5 text-xs">{INTEREST_EMOJI[i]} {interest(i)}</span>)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <ScoreRing score={d.score} size={96} label={t('student.satisfaction')} />
          <Link to={`/dorm?student=${s.id}`} className="btn-ghost"><Building2 size={16} />{t('student.room', { id: d.room.id })}</Link>
        </div>
      </section>

      <dl className="panel grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 overflow-hidden">
        {habits.map(([k, v]) => (
          <div key={k} className="p-4 border-b sm:border-b-0 border-r border-line dark:border-night-line last:border-r-0">
            <dt className="text-xs muted">{t(`f.${k}`)}</dt><dd className="font-display font-bold text-lg mt-1">{v}</dd>
          </div>
        ))}
      </dl>

      {notice && <p className="text-sm text-good" role="status">{notice}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="panel p-6">
          <h2 className="text-base font-bold mb-4">{t('student.roommates')}</h2>
          {s.friend_id && <p className="text-xs muted mb-3">🤝 {t('student.friend')}</p>}
          {d.roommates.length === 0 && <p className="muted text-sm">{t('dorm.alone')}</p>}
          <ul className="space-y-5">
            {d.roommates.map((p) => (
              <li key={p.id}>
                <Link to={`/student/${p.id}`} className="block rounded-xl -mx-2 px-2 py-1.5 hover:bg-paper dark:hover:bg-night mb-2">
                  <PersonLine person={p} right={<ScorePill score={p.score} />} />
                </Link>
                <Reasons reasons={p.reasons} />
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-6">
          <h2 className="text-base font-bold mb-1">{t('student.swaps')}</h2>
          <p className="text-sm muted mb-4">{t('student.swaps.d')}</p>
          {d.swaps.length === 0 && <p className="text-sm">{t('student.swaps.none')}</p>}
          <ul className="space-y-3">
            {d.swaps.map((w) => (
              <li key={w.with.id} className="rounded-xl border border-line dark:border-night-line p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-48"><PersonLine person={w.with} /></div>
                <div className="text-xs leading-relaxed">
                  <div className="text-good font-semibold">{t('student.gainSelf', { n: fmt(w.gain_self, 1) })}</div>
                  <div className="muted">{t('student.gainOther', { n: `${w.gain_other >= 0 ? '+' : ''}${fmt(w.gain_other, 1)}`, name: w.with.name })}</div>
                </div>
                <button className="btn-ghost" disabled={busy} onClick={() => swap(w.with.id)}><ArrowLeftRight size={15} />{t('student.swap')} ({w.with.room})</button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel p-6">
        <h2 className="text-base font-bold mb-4">{t('student.matches')}</h2>
        <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-5">
          {d.top_matches.map((p) => (
            <li key={p.id}>
              <Link to={`/pair?a=${s.id}&b=${p.id}`} className="block rounded-xl -mx-2 px-2 py-1.5 hover:bg-paper dark:hover:bg-night mb-1">
                <PersonLine person={p} right={<ScorePill score={p.score} />} />
              </Link>
              <Reasons reasons={p.reasons} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
