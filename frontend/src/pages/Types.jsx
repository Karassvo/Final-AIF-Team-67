import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine } from 'recharts'
import { api } from '../api'
import { INTEREST_EMOJI, useI18n } from '../i18n'
import { TYPE_COLORS, fmt, hourStr } from '../lib'
import { ErrorBox, Loader, PageHeader, Segmented, useAsync } from '../components/ui'

function traitValue(f, v) {
  return f === 'bedtime' || f === 'wake_time' ? hourStr(v) : `${fmt(v, 1)}/5`
}

export default function Types() {
  const { t, typeName, interest } = useI18n()
  const nav = useNavigate()
  const data = useAsync(() => api.clusters(), [])
  const [k, setK] = useState('auto')
  const [busy, setBusy] = useState(false)

  async function changeK(v) {
    setK(v); setBusy(true)
    try { data.setData(await api.setK(v === 'auto' ? null : v)) } finally { setBusy(false) }
  }

  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />
  if (!data.data) return <Loader />
  const d = data.data
  const ka = d.k_analysis
  const curve = ka.k_values.map((kv, i) => ({ k: kv, inertia: ka.inertia[i], silhouette: ka.silhouette[i] }))

  return (
    <div>
      <PageHeader title={t('types.title')} lead={t('types.lead')}>
        <Segmented label={t('types.k')} value={k} onChange={changeK}
          options={[{ value: 'auto', label: t('types.auto') }, ...[3, 4, 5, 6, 7].map((v) => ({ value: v, label: String(v) }))]} />
      </PageHeader>

      <div className="grid xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 mb-6">
        <section className="panel p-5" aria-label="PCA">
          <div className="flex flex-wrap justify-between gap-2 text-xs muted mb-2">
            <span>{t('types.quality', { s: fmt(d.silhouette, 2), a: d.ari_vs_true_archetypes != null ? fmt(d.ari_vs_true_archetypes, 2) : '—' })}</span>
            <span>{t('types.pca', { v: fmt((d.pca_explained[0] + d.pca_explained[1]) * 100) })}</span>
          </div>
          <div className={busy ? 'opacity-40 transition-opacity' : 'transition-opacity'}>
            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.08} />
                <XAxis type="number" dataKey="x" tick={false} axisLine={false} name="PC1" />
                <YAxis type="number" dataKey="y" tick={false} axisLine={false} name="PC2" />
                <ZAxis range={[46, 46]} />
                <Tooltip cursor={false} content={({ payload }) => payload?.[0] ? (
                  <div className="panel px-3 py-2 text-sm shadow-lg">
                    {payload[0].payload.name} <span className="muted">#{payload[0].payload.id}</span>
                  </div>) : null} />
                {d.clusters.map((c) => (
                  <Scatter key={c.id} data={d.points.filter((p) => p.cluster === c.id)} fill={TYPE_COLORS[c.id % TYPE_COLORS.length]}
                    fillOpacity={0.85} onClick={(p) => nav(`/student/${p.id}`)} className="cursor-pointer" />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-bold mb-1">{t('types.elbow')}</h2>
          <p className="text-xs muted mb-4">k = {ka.elbow_k} ({t('types.inertia').toLowerCase()}), k = {ka.silhouette_k} ({t('types.silhouette').toLowerCase()})</p>
          {[['inertia', t('types.inertia'), TYPE_COLORS[0]], ['silhouette', t('types.silhouette'), TYPE_COLORS[2]]].map(([key, label, color]) => (
            <div key={key} className="mb-4">
              <div className="text-xs font-medium mb-1">{label}</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={curve} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.08} />
                  <XAxis dataKey="k" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} />
                  <YAxis tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} domain={['auto', 'auto']} />
                  <Tooltip />
                  <ReferenceLine x={d.k} stroke="#F2B705" strokeDasharray="4 3" />
                  <Line dataKey={key} stroke={color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </section>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {d.clusters.map((c) => (
          <article key={c.id} className="panel p-5 border-t-4" style={{ borderTopColor: TYPE_COLORS[c.id % TYPE_COLORS.length] }}>
            <div className="flex items-start gap-3">
              <span className="text-4xl" aria-hidden>{c.emoji}</span>
              <div>
                <h3 className="text-lg font-bold">{typeName(c)}</h3>
                <p className="text-xs muted">{t('types.size', { n: c.size })}{c.smokers_pct ? `, ${t('types.smokers', { n: fmt(c.smokers_pct) })}` : ''}</p>
              </div>
            </div>
            <p className="text-sm mt-3 leading-relaxed">{t(`type.${c.key}.d`)}</p>
            <h4 className="text-xs muted mt-4 mb-2">{t('types.traits')}</h4>
            <ul className="space-y-1">
              {c.traits.map((tr) => (
                <li key={tr.feature} className="flex items-center gap-2 text-sm">
                  {tr.z > 0 ? <ArrowUp size={14} className="text-sky-deep dark:text-sky" /> : <ArrowDown size={14} className="text-sun" />}
                  <span className="flex-1">{t(`f.${tr.feature}`)}</span>
                  <span className="tabular-nums font-medium">{traitValue(tr.feature, tr.value)}</span>
                </li>
              ))}
            </ul>
            {c.top_interests.length > 0 && (
              <>
                <h4 className="text-xs muted mt-4 mb-2">{t('types.interests')}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {c.top_interests.map((i) => (
                    <span key={i.interest} className="rounded-full bg-paper dark:bg-night px-2.5 py-0.5 text-xs">
                      {INTEREST_EMOJI[i.interest]} {interest(i.interest)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
