// Shared helpers: score colours, formatting.

// Compatibility scale: conflict red -> amber -> green. Interpolated in RGB.
const STOPS = [
  [0, [229, 72, 77]],
  [45, [242, 183, 5]],
  [75, [47, 179, 128]],
  [100, [24, 140, 98]],
]
export function scoreColor(score, alpha = 1) {
  if (score == null || score < 0) return `rgba(150,155,180,${alpha * 0.35})`
  const s = Math.max(0, Math.min(100, score))
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, c1] = STOPS[i]
    const [x0, c0] = STOPS[i - 1]
    if (s <= x1) {
      const t = (s - x0) / (x1 - x0)
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t))
      return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`
    }
  }
  return `rgba(24,140,98,${alpha})`
}

export const fmt = (n, d = 0) => (n == null ? '—' : Number(n).toFixed(d))

export function hourStr(h) {
  const hh = Math.floor(h % 24)
  const mm = Math.round((h - Math.floor(h)) * 60) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export const TYPE_COLORS = ['#2BA6C9', '#F2B705', '#7C6CE0', '#2FB380', '#E5734D', '#D9539A', '#5C8A3A', '#8A93B8']

export function initials(name) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}
