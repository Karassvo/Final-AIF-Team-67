import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Play, RefreshCw, Search } from 'lucide-react'
import { api } from '../api'
import { useI18n } from '../i18n'
import { fmt } from '../lib'
import { FloorPlan, ScoreLegend } from '../components/FloorPlan'
import { ErrorBox, Kpi, Loader, PageHeader, PersonLine, Reasons, ScorePill, ScoreRing, useAsync } from '../components/ui'

const METHODS = ['random', 'greedy', 'annealing', 'fair_annealing']

function RoomPanel({ room }) {
  const { t } = useI18n()
  const [pairs, setPairs] = useState(null)
  useEffect(() => {
    let alive = true
    setPairs(null)
    const res = room.residents
    const jobs = []
    for (let a = 0; a < res.length; a++) for (let b = a + 1; b < res.length; b++) jobs.push(api.pair(res[a].id, res[b].id))
    Promise.all(jobs).then((p) => alive && setPairs(p)).catch(() => alive && setPairs([]))
    return () => { alive = false }
  }, [room])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <ScoreRing score={room.score ?? 0} size={78} stroke={8} />
        <div>
          <h2 className="text-xl font-bold">{t('dorm.roomTitle', { id: room.id })}</h2>
          <p className="text-sm muted">
            {t('common.floor')} {room.id.split('-')[0]}, {room.residents.length}/{room.capacity}
            {room.smoking ? `, ${t('common.smoking').toLowerCase()}` : ''}
          </p>
        </div>
      </div>
      <ul className="space-y-1">
        {room.residents.map((r) => (
          <li key={r.id}>
            <Link to={`/student/${r.id}`} className="block rounded-xl -mx-2 px-2 py-1.5 hover:bg-paper dark:hover:bg-night">
              <PersonLine person={r} right={<ScorePill score={r.score} />} />
            </Link>
          </li>
        ))}
        {Array.from({ length: room.capacity - room.residents.length }).map((_, k) => (
          <li key={`e${k}`} className="flex items-center gap-3 py-1.5 muted text-sm">
            <span className="w-9 h-9 rounded-full border-2 border-dashed border-line dark:border-night-line" />
            {t('common.empty')}
          </li>
        ))}
      </ul>
      {room.residents.length === 1 && <p className="text-sm muted">{t('dorm.alone')}</p>}
      {room.residents.length > 1 && (
        <div>
          <h3 className="font-sans font-semibold text-sm mb-3 tracking-normal">{t('dorm.why')}</h3>
          {!pairs && <Loader />}
          <div className="space-y-4">
            {pairs?.map((p) => (
              <Link key={`${p.a.id}-${p.b.id}`} to={`/pair?a=${p.a.id}&b=${p.b.id}`}
                className="block rounded-xl border border-line dark:border-night-line p-3 hover:border-sky">
                <div className="flex justify-between items-center mb-2 text-sm font-medium">
                  <span className="truncate">{p.a.name} + {p.b.name}</span>
                  <ScorePill score={p.score} />
                </div>
                <Reasons reasons={p.reasons} limit={4} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dorm() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const dorm = useAsync(() => api.dorm(), [])
  const summary = useAsync(() => api.summary(), [])
  const [selected, setSelected] = useState(null)
  const [method, setMethod] = useState('fair_annealing')
  const [fairness, setFairness] = useState(0.5)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [frame, setFrame] = useState(null)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(params.get('student') ? Number(params.get('student')) : null)
  const timer = useRef(null)

  const rooms = useMemo(() => dorm.data?.floors.flatMap((f) => f.rooms) ?? [], [dorm.data])
  const residents = useMemo(() => rooms.flatMap((r) => r.residents.map((p) => ({ ...p, room: r.index }))), [rooms])

  useEffect(() => {
    if (highlight != null && residents.length) {
      const p = residents.find((r) => r.id === highlight)
      if (p) setSelected(p.room)
    }
  }, [highlight, residents])
  useEffect(() => () => clearInterval(timer.current), [])

  const room = selected != null ? rooms.find((r) => r.index === selected) : null

  async function reassign() {
    setBusy(true); setNotice(null)
    try {
      const r = await api.assign({ method, fairness, iterations: 25000 })
      await Promise.all([dorm.reload(), summary.reload()])
      setNotice(t('dorm.done', { s: fmt(r.seconds, 1) }))
      if (r.frames?.length > 1) replay(r.frames)
    } catch (e) { setNotice(e.message) } finally { setBusy(false) }
  }

  function replay(frames = dorm.data?.frames) {
    if (!frames || frames.length < 2) return
    clearInterval(timer.current)
    let i = 0
    setFrame(frames[0])
    timer.current = setInterval(() => {
      i += 1
      if (i >= frames.length) { clearInterval(timer.current); setFrame(null); return }
      setFrame(frames[i])
    }, 110)
  }

  function find(e) {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    const p = residents.find((r) => r.name.toLowerCase().includes(q) || String(r.id) === q)
    if (p) { setHighlight(p.id); setSelected(p.room); setParams({ student: p.id }) }
  }

  if (dorm.error) return <ErrorBox error={dorm.error} onRetry={dorm.reload} />
  if (!dorm.data || !summary.data) return <Loader />
  const m = summary.data.metrics

  return (
    <div>
      <PageHeader title={t('dorm.title')} lead={t('dorm.lead')}>
        <a className="btn-ghost" href={api.exportUrl}><Download size={16} />{t('common.export')}</a>
      </PageHeader>

      <div className="panel p-5 mb-6 grid grid-cols-2 md:grid-cols-5 gap-5">
        <Kpi label={t('kpi.students')} value={summary.data.n_students} hint={`${summary.data.n_rooms} ${t('common.rooms')}`} />
        <Kpi label={t('kpi.mean')} value={fmt(m.mean_score)} unit="/100" />
        <Kpi label={t('kpi.worst')} value={fmt(m.worst10_score)} unit="/100" />
        <Kpi label={t('kpi.conflict')} value={fmt(m.conflict_rate, 1)} unit="%" tone={m.conflict_rate < 3 ? 'good' : 'bad'} />
        {m.true_mean != null && <Kpi label={t('kpi.real')} value={fmt(m.true_mean)} unit="/100" />}
      </div>

      <div className="panel p-4 mb-6 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-xs muted">{t('dorm.method')}</span>
          <select className="field mt-1 min-w-56" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((x) => <option key={x} value={x}>{t(`method.${x}`)}</option>)}
          </select>
        </label>
        {method === 'fair_annealing' && (
          <label className="block w-44">
            <span className="block text-xs muted">{t('dorm.fairness')}: {fairness}</span>
            <input type="range" min="0" max="3" step="0.25" value={fairness} onChange={(e) => setFairness(Number(e.target.value))} className="w-full mt-3" />
          </label>
        )}
        <button className="btn-primary" onClick={reassign} disabled={busy}>
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />{busy ? t('common.running') : t('dorm.reassign')}
        </button>
        <button className="btn-ghost" onClick={() => replay()} disabled={busy || !(dorm.data.frames?.length > 1)}>
          <Play size={16} />{t('dorm.replay')}
        </button>
        <p className="text-xs muted basis-full lg:basis-auto lg:flex-1 lg:self-center">{t(`method.${method}.d`)}</p>
        <form onSubmit={find} className="flex gap-2 items-end">
          <label className="block">
            <span className="block text-xs muted">{t('dorm.find')}</span>
            <input className="field mt-1 w-48" list="dorm-people" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} />
            <datalist id="dorm-people">{residents.map((r) => <option key={r.id} value={r.name} />)}</datalist>
          </label>
          <button className="btn-ghost px-3" aria-label={t('dorm.find')}><Search size={16} /></button>
        </form>
        {notice && <p className="basis-full text-sm text-good" role="status">{notice}</p>}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="panel p-4 sm:p-5 overflow-x-auto scrollbar-thin">
          <div className="min-w-[640px]">
            <FloorPlan floors={dorm.data.floors} selected={selected} onSelect={setSelected} frameScores={frame} highlight={highlight} />
          </div>
          <div className="mt-4 flex justify-end"><ScoreLegend /></div>
        </div>
        <aside className="panel p-5 xl:sticky xl:top-6">
          {room ? <RoomPanel room={room} /> : <p className="muted text-sm py-10 text-center">{t('dorm.pickRoom')}</p>}
        </aside>
      </div>
    </div>
  )
}
