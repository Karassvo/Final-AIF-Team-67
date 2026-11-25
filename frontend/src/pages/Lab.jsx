import { useEffect, useRef, useState } from 'react'
import { Brain, Database, Flame, Play, RotateCcw, Upload, Wand2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import clsx from 'clsx'
import { api } from '../api'
import { useI18n } from '../i18n'
import { TYPE_COLORS, fmt } from '../lib'
import { ErrorBox, Loader, PageHeader, Segmented } from '../components/ui'

const axis = { tick: { fontSize: 11 }, stroke: 'currentColor', strokeOpacity: 0.4 }
const grid = <CartesianGrid stroke="currentColor" strokeOpacity={0.08} />

function useRunner() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const run = async (fn) => {
    setBusy(true); setError(null)
    try { return await fn() } catch (e) { setError(e) } finally { setBusy(false) }
  }
  return { busy, error, run }
}

/* ------------------------------------------------------------- compare */
function Compare() {
  const { t } = useI18n()
  const { busy, error, run } = useRunner()
  const [res, setRes] = useState(null)
  const seeds = 2
  const rows = res?.rows ?? []
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn-primary" disabled={busy} onClick={() => run(async () => setRes(await api.compare({ seeds, iterations: 15000 })))}>
          <Play size={16} />{busy ? t('common.running') : t('lab.compare.run')}
        </button>
        <p className="text-sm muted max-w-2xl">{t('lab.compare.d', { n: seeds })}</p>
      </div>
      {error && <ErrorBox error={error} />}
      {busy && <Loader />}
      {rows.length > 0 && (
        <>
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left muted border-b border-line dark:border-night-line">
                  {['method', 'mean', 'worst', 'conflict', 'trueMean', 'trueWorst', 'time'].map((c) => (
                    <th key={c} className="px-4 py-3 font-medium">{t(`lab.col.${c}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const best = (k, low) => (low ? Math.min : Math.max)(...rows.map((x) => x[k])) === r[k]
                  const cell = (k, d = 1, low = false) => (
                    <td className={clsx('px-4 py-3 tabular-nums', best(k, low) && 'font-bold text-good')}>{fmt(r[k], d)}</td>)
                  return (
                    <tr key={r.method} className="border-b last:border-0 border-line dark:border-night-line">
                      <td className="px-4 py-3">
                        <div className="font-medium">{t(`method.${r.method}`)}</div>
                        <div className="text-xs muted">{t(`method.${r.method}.d`)}</div>
                      </td>
                      {cell('mean_score')}{cell('worst10_score')}{cell('conflict_rate', 1, true)}
                      {cell('true_mean')}{cell('true_worst10')}
                      <td className="px-4 py-3 tabular-nums muted">{t('common.seconds', { n: fmt(r.seconds, 2) })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="panel p-5">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rows.map((r) => ({ ...r, name: t(`method.${r.method}`) }))} margin={{ top: 10, right: 10, left: -10 }}>
                {grid}
                <XAxis dataKey="name" {...axis} />
                <YAxis domain={[0, 100]} {...axis} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="true_mean" name={t('lab.col.trueMean')} fill={TYPE_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="true_worst10" name={t('lab.col.trueWorst')} fill={TYPE_COLORS[2]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="conflict_rate" name={t('lab.col.conflict')} fill="#E5484D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- annealing */
function Annealing() {
  const { t } = useI18n()
  const { busy, error, run } = useRunner()
  const [iters, setIters] = useState(25000)
  const [fair, setFair] = useState(0.5)
  const [res, setRes] = useState(null)
  const [shown, setShown] = useState(0)
  const timer = useRef(null)
  useEffect(() => () => clearInterval(timer.current), [])

  async function go() {
    const r = await run(() => api.assign({ method: fair > 0 ? 'fair_annealing' : 'annealing', fairness: fair, iterations: iters }))
    if (!r) return
    setRes(r)
    setShown(1)
    clearInterval(timer.current)
    timer.current = setInterval(() => setShown((s) => {
      if (s >= r.history.length) { clearInterval(timer.current); return s }
      return s + 3
    }), 30)
  }
  const data = res?.history.slice(0, shown) ?? []
  return (
    <div className="space-y-6">
      <p className="text-sm muted max-w-3xl leading-relaxed">{t('lab.sa.d')}</p>
      <div className="panel p-4 flex flex-wrap items-end gap-6">
        <label className="block w-56">
          <span className="block text-xs muted">{t('lab.sa.iter')}: {iters.toLocaleString()}</span>
          <input type="range" min="2000" max="80000" step="1000" value={iters} onChange={(e) => setIters(Number(e.target.value))} className="w-full mt-3" />
        </label>
        <label className="block w-44">
          <span className="block text-xs muted">{t('dorm.fairness')}: {fair}</span>
          <input type="range" min="0" max="3" step="0.25" value={fair} onChange={(e) => setFair(Number(e.target.value))} className="w-full mt-3" />
        </label>
        <button className="btn-primary" onClick={go} disabled={busy}><Flame size={16} />{busy ? t('common.running') : t('lab.sa.run')}</button>
        {res && <span className="text-sm muted">{t('lab.sa.stats', { acc: res.annealing.accepted.toLocaleString(), imp: res.annealing.improved.toLocaleString(), s: fmt(res.annealing.seconds, 1) })}</span>}
      </div>
      {error && <ErrorBox error={error} />}
      {res && (
        <div className="panel p-5">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data} margin={{ top: 10, right: 0, left: -10 }}>
              {grid}
              <XAxis dataKey="iter" type="number" domain={[0, res.annealing.iterations]} {...axis} />
              <YAxis yAxisId="s" domain={['auto', 'auto']} {...axis} />
              <YAxis yAxisId="t" orientation="right" {...axis} tickFormatter={(v) => v.toFixed(2)} />
              <Tooltip formatter={(v) => fmt(v, 3)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="s" dataKey="mean" name={t('lab.sa.mean')} stroke={TYPE_COLORS[0]} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line yAxisId="s" dataKey="worst10" name={t('lab.sa.worst')} stroke={TYPE_COLORS[2]} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line yAxisId="t" dataKey="temperature" name={t('lab.sa.temperature')} stroke={TYPE_COLORS[1]} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- learning */
function TreeNode({ node, depth = 0 }) {
  const { t } = useI18n()
  const leaf = !node.feature
  return (
    <div className={clsx(depth > 0 && 'pl-4 border-l border-line dark:border-night-line ml-1.5')}>
      {leaf ? (
        <div className="py-0.5 text-xs">
          <span className="rounded px-1.5 py-0.5" style={{ background: node.proba >= 0.5 ? '#fde8e8' : '#e3f6ee', color: node.proba >= 0.5 ? '#b4232a' : '#1e7a56' }}>
            {t('lab.learn.conflictP', { p: fmt(node.proba * 100) })}
          </span>
          <span className="muted ml-2">n={node.samples}</span>
        </div>
      ) : (
        <>
          <div className="py-0.5 text-xs font-medium">{t(`in.${node.feature}`)} ≤ {node.threshold}</div>
          <TreeNode node={node.left} depth={depth + 1} />
          <div className="py-0.5 text-xs font-medium">{t(`in.${node.feature}`)} &gt; {node.threshold}</div>
          <TreeNode node={node.right} depth={depth + 1} />
        </>
      )}
    </div>
  )
}

function Learning() {
  const { t } = useI18n()
  const { busy, error, run } = useRunner()
  const [res, setRes] = useState(null)
  const [effect, setEffect] = useState(null)
  useEffect(() => { api.learnResult().then((r) => r && setRes(r)).catch(() => {}) }, [])

  const imp = res ? Object.entries(res.forest.importance).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: t(`in.${k}`), v })) : []
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <button className="btn-primary" disabled={busy} onClick={() => run(async () => { setEffect(null); setRes(await api.learn({ generations: 40, population: 40 })) })}>
          <Brain size={16} />{busy ? t('common.running') : t('lab.learn.run')}
        </button>
        {res && !res.applied && (
          <button className="btn-ghost" disabled={busy} onClick={() => run(async () => { setEffect(await api.applyLearned()); setRes((r) => ({ ...r, applied: true })) })}>
            <Wand2 size={16} />{t('lab.learn.apply')}
          </button>
        )}
        {res?.applied && (
          <>
            <span className="text-sm text-good font-medium">{t('lab.learn.applied')}</span>
            <button className="btn-ghost" disabled={busy} onClick={() => run(async () => { await api.resetLearned(); setRes((r) => ({ ...r, applied: false })); setEffect(null) })}>
              <RotateCcw size={16} />{t('lab.learn.reset')}
            </button>
          </>
        )}
      </div>
      {error && <ErrorBox error={error} />}
      {busy && <Loader />}
      {res && (
        <>
          <p className="text-sm muted">{t('lab.learn.d', { n: res.n_pairs })}</p>
          {effect && (
            <div className="panel p-5">
              <h3 className="font-sans font-semibold text-sm mb-3 tracking-normal">{t('lab.learn.effect')}</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {[['true_mean', 'kpi.mean'], ['true_worst10', 'kpi.worst'], ['true_conflict_rate', 'kpi.conflict']].map(([k, label]) => (
                  <div key={k}>
                    <div className="text-xs muted">{t(label)}</div>
                    <div className="font-display text-xl font-bold tabular-nums">{fmt(effect.before[k], 1)} → <span className="text-good">{fmt(effect.after[k], 1)}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="panel p-5">
              <h3 className="font-sans font-semibold tracking-normal">{t('lab.learn.importance')}</h3>
              <p className="text-xs muted mb-3">{t('lab.learn.importance.d')}</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={imp} layout="vertical" margin={{ left: 40, right: 20 }}>
                  {grid}
                  <XAxis type="number" {...axis} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                  <YAxis type="category" dataKey="name" width={150} {...axis} />
                  <Tooltip formatter={(v) => `${fmt(v * 100, 1)}%`} />
                  <Bar dataKey="v" fill={TYPE_COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className="panel p-5">
              <h3 className="font-sans font-semibold tracking-normal">{t('lab.learn.ga')}</h3>
              <p className="text-xs muted mb-3">{t('lab.learn.ga.d')}</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={res.ga.history} margin={{ left: -10, right: 10 }}>
                  {grid}
                  <XAxis dataKey="generation" {...axis} />
                  <YAxis domain={['auto', 'auto']} {...axis} tickFormatter={(v) => v.toFixed(2)} />
                  <Tooltip formatter={(v) => fmt(v, 3)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={res.ga.corr_before_train} stroke="#9ca3af" strokeDasharray="4 3" label={{ value: t('lab.learn.before'), fontSize: 11, position: 'insideBottomRight', fill: 'currentColor' }} />
                  <Line dataKey="best" name={t('lab.learn.best')} stroke={TYPE_COLORS[2]} strokeWidth={2} dot={false} />
                  <Line dataKey="mean" name={t('lab.learn.avg')} stroke={TYPE_COLORS[3]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          </div>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
            <section className="panel p-5">
              <h3 className="font-sans font-semibold mb-3 tracking-normal">{t('lab.learn.models')}</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-left muted"><th className="py-2 font-medium">{t('lab.learn.model')}</th><th className="font-medium">Accuracy</th><th className="font-medium">Precision</th><th className="font-medium">Recall</th><th className="font-medium">F1</th></tr></thead>
                <tbody>
                  {[['lab.learn.baseline', res.baseline], ['lab.learn.tree', res.tree.metrics], ['lab.learn.forest', res.forest.metrics]].map(([k, m]) => (
                    <tr key={k} className="border-t border-line dark:border-night-line tabular-nums">
                      <td className="py-2">{t(k)}</td><td>{fmt(m.accuracy, 2)}</td><td>{fmt(m.precision, 2)}</td><td>{fmt(m.recall, 2)}</td><td className="font-semibold">{fmt(m.f1, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="font-sans font-semibold mt-6 mb-2 tracking-normal">{t('lab.learn.corr')}</h3>
              <p className="font-display text-2xl font-bold tabular-nums">
                {fmt(res.ga.corr_before_test, 3)} <span className="muted text-base font-sans font-normal">{t('lab.learn.before')}</span>
                <span className="mx-3 muted">→</span>
                <span className="text-good">{fmt(res.ga.corr_after_test, 3)}</span> <span className="muted text-base font-sans font-normal">{t('lab.learn.after')}</span>
              </p>
            </section>
            <section className="panel p-5 overflow-auto max-h-[420px] scrollbar-thin">
              <h3 className="font-sans font-semibold mb-3 tracking-normal">{t('lab.learn.treeRules')}</h3>
              <TreeNode node={res.tree.structure} />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- data */
function DataPanel() {
  const { t } = useI18n()
  const { busy, error, run } = useRunner()
  const [n, setN] = useState(240)
  const [msg, setMsg] = useState(null)
  return (
    <section className="panel p-5 flex flex-wrap items-end gap-4">
      <div className="basis-full md:basis-auto md:flex-1">
        <h2 className="font-sans font-semibold flex items-center gap-2 tracking-normal"><Database size={16} />{t('lab.data')}</h2>
        <p className="text-xs muted mt-1">{t('lab.data.d')}</p>
      </div>
      <label className="block">
        <span className="block text-xs muted">{t('lab.data.n')}</span>
        <input type="number" min="20" max="1200" step="20" value={n} onChange={(e) => setN(Number(e.target.value))} className="field mt-1 w-28" />
      </label>
      <button className="btn-ghost" disabled={busy} onClick={() => run(async () => {
        const s = await api.generate({ n_students: n, seed: Math.floor(Math.random() * 10000) })
        setMsg(`${s.n_students} ${t('common.students')}, ${s.n_rooms} ${t('common.rooms')}`)
      })}>{busy ? t('common.running') : t('lab.data.generate')}</button>
      <label className="btn-ghost cursor-pointer">
        <Upload size={16} />{t('lab.data.upload')}
        <input type="file" accept=".csv" className="sr-only" onChange={(e) => e.target.files[0] && run(async () => {
          const s = await api.uploadStudents(e.target.files[0])
          setMsg(`${s.n_students} ${t('common.students')}, ${s.n_rooms} ${t('common.rooms')}`)
        })} />
      </label>
      {msg && <p className="basis-full text-sm text-good" role="status">{msg}</p>}
      {error && <div className="basis-full"><ErrorBox error={error} /></div>}
    </section>
  )
}

export default function Lab() {
  const { t } = useI18n()
  const [tab, setTab] = useState('compare')
  return (
    <div className="space-y-6">
      <PageHeader title={t('lab.title')} lead={t('lab.lead')}>
        <Segmented value={tab} onChange={setTab} label={t('lab.title')}
          options={[{ value: 'compare', label: t('lab.tab.compare') }, { value: 'sa', label: t('lab.tab.sa') }, { value: 'learn', label: t('lab.tab.learn') }]} />
      </PageHeader>
      {tab === 'compare' && <Compare />}
      {tab === 'sa' && <Annealing />}
      {tab === 'learn' && <Learning />}
      <DataPanel />
    </div>
  )
}
