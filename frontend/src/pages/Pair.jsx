import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shuffle, Sparkles } from 'lucide-react'
import { Area, AreaChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis, Legend } from 'recharts'
import { api } from '../api'
import { useI18n } from '../i18n'
import { TYPE_COLORS, fmt, scoreColor } from '../lib'
import { ErrorBox, Loader, PageHeader, PersonLine, Reasons, ScoreRing, StudentPicker, useAsync } from '../components/ui'

const INPUT_UNITS = { sleep_diff: 'h', clean_diff: '', noise_conflict: '', social_diff: '' }

function Memberships({ name, crisp, mem }) {
  const { t } = useI18n()
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium">{t(`in.${name}`)}</span>
        <span className="tabular-nums muted">{fmt(crisp, 1)}{INPUT_UNITS[name]}</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['small', 'medium', 'large'].map((term) => (
          <div key={term} className="text-[11px]">
            <div className="h-2 rounded-full bg-line dark:bg-night-line overflow-hidden">
              <div className="h-full rounded-full bg-sky" style={{ width: `${mem[term] * 100}%`, transition: 'width 400ms ease' }} />
            </div>
            <div className="flex justify-between mt-0.5 muted"><span>{t(`term.${term}`)}</span><span className="tabular-nums">{fmt(mem[term], 2)}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RuleText({ rule }) {
  const { t } = useI18n()
  const parts = Object.entries(rule.if).map(([k, v]) => `${t(`in.${k}`)} = ${t(`term.${v}`)}`)
  return (
    <span>
      <span className="muted">{t('pair.if')} </span>{parts.join(` ${t('pair.and')} `)}
      <span className="muted"> {t('pair.then')} </span>{t('out')} = <b>{t(`term.${rule.then}`)}</b>
    </span>
  )
}

export default function Pair() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const students = useAsync(() => api.students(), [])
  const a = params.get('a') ? Number(params.get('a')) : null
  const b = params.get('b') ? Number(params.get('b')) : null
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (students.data && (a == null || b == null)) {
      const s0 = students.data[0]
      const s1 = students.data.find((s) => s.id !== s0.id && s.gender === s0.gender)
      setParams({ a: s0.id, b: s1.id }, { replace: true })
    }
  }, [students.data, a, b, setParams])

  useEffect(() => {
    if (a == null || b == null) return
    let alive = true
    setError(null)
    api.pair(a, b).then((d) => alive && setData(d)).catch((e) => alive && setError(e))
    return () => { alive = false }
  }, [a, b])

  const radar = useMemo(() => {
    if (!data) return []
    return Object.keys(data.a.profile).map((f) => ({ f: t(`f.${f}`), a: data.a.profile[f], b: data.b.profile[f] }))
  }, [data, t])

  function randomPair() {
    const list = students.data
    const s0 = list[Math.floor(Math.random() * list.length)]
    const same = list.filter((s) => s.gender === s0.gender && s.id !== s0.id)
    setParams({ a: s0.id, b: same[Math.floor(Math.random() * same.length)].id })
  }
  async function greatPair() {
    const d = await api.student(a)
    if (d.top_matches[0]) setParams({ a, b: d.top_matches[0].id })
  }

  if (students.error) return <ErrorBox error={students.error} onRetry={students.reload} />
  if (!students.data) return <Loader />
  const agg = data?.fuzzy.aggregated.map((v, i) => ({ x: i * 5, v })) ?? []

  return (
    <div>
      <PageHeader title={t('pair.title')} lead={t('pair.lead')}>
        <button className="btn-ghost" onClick={randomPair}><Shuffle size={16} />{t('pair.random')}</button>
        <button className="btn-ghost" onClick={greatPair}><Sparkles size={16} />{t('pair.goodPair')}</button>
      </PageHeader>

      <div className="panel p-4 mb-6 grid sm:grid-cols-2 gap-4">
        <StudentPicker label={t('pair.a')} students={students.data} value={a} onChange={(v) => setParams({ a: v, b })} />
        <StudentPicker label={t('pair.b')} students={students.data} value={b} onChange={(v) => setParams({ a, b: v })} />
      </div>

      {error && <ErrorBox error={error} />}
      {!data && !error && <Loader />}
      {data && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
            <section className="panel p-6 flex flex-col gap-6">
              <div className="flex items-center gap-6">
                <ScoreRing score={data.score} size={124} stroke={11} label={t('pair.score')} />
                <div className="space-y-3 flex-1 min-w-0">
                  <PersonLine person={{ ...data.a, cluster: data.a.cluster }} />
                  <PersonLine person={{ ...data.b, cluster: data.b.cluster }} />
                </div>
              </div>
              <div className="text-xs muted space-y-1">
                {data.true_score != null && <p>{t('pair.true', { n: fmt(data.true_score) })}</p>}
                {data.same_room && <p className="text-good font-medium">{t('pair.sameRoom')}</p>}
              </div>
              <div>
                <h2 className="font-sans text-sm font-semibold mb-3 tracking-normal">{t('pair.reasons')}</h2>
                <Reasons reasons={data.reasons} />
              </div>
            </section>
            <section className="panel p-5">
              <h2 className="font-sans text-sm font-semibold tracking-normal">{t('pair.habits')}</h2>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="currentColor" strokeOpacity={0.15} />
                  <PolarAngleAxis dataKey="f" tick={{ fontSize: 11, fill: 'currentColor' }} />
                  <Radar name={data.a.name} dataKey="a" stroke={TYPE_COLORS[0]} fill={TYPE_COLORS[0]} fillOpacity={0.25} strokeWidth={2} />
                  <Radar name={data.b.name} dataKey="b" stroke={TYPE_COLORS[1]} fill={TYPE_COLORS[1]} fillOpacity={0.25} strokeWidth={2} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <section className="panel p-6">
            <h2 className="text-lg font-bold mb-6">{t('pair.trace')}</h2>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="space-y-5">
                <h3 className="font-sans text-sm font-semibold tracking-normal">{t('pair.memberships')}</h3>
                {Object.entries(data.fuzzy.memberships).map(([name, mem]) => (
                  <Memberships key={name} name={name} crisp={data.fuzzy.inputs[name]} mem={mem} />
                ))}
              </div>
              <div>
                <h3 className="font-sans text-sm font-semibold mb-4 tracking-normal">{t('pair.rules')}</h3>
                <ul className="space-y-3 text-sm">
                  {data.fuzzy.fired_rules.slice(0, 7).map((r) => (
                    <li key={r.rule}>
                      <RuleText rule={r} />
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 flex-1 rounded-full bg-line dark:bg-night-line overflow-hidden">
                          <div className="h-full bg-sun rounded-full" style={{ width: `${r.strength * 100}%` }} />
                        </div>
                        <span className="text-xs tabular-nums muted w-20 text-right">{t('pair.strength')} {fmt(r.strength, 2)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-sans text-sm font-semibold mb-4 tracking-normal">{t('pair.output')}</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={agg} margin={{ top: 24, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="x" type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} />
                    <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} />
                    <Area dataKey="v" type="linear" stroke={TYPE_COLORS[2]} fill={TYPE_COLORS[2]} fillOpacity={0.25} isAnimationActive={false} />
                    <ReferenceLine x={data.fuzzy.score} stroke={scoreColor(data.fuzzy.score)} strokeWidth={2}
                      label={{ value: fmt(data.fuzzy.score), position: 'top', fontSize: 12, fill: 'currentColor' }} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-xs muted mt-3 leading-relaxed">
                  Mamdani: AND = min, implication = min, aggregation = max, defuzzification = centroid.
                  Final score = 0.82 × fuzzy (rescaled) + language + shared interests − smoking mismatch.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
