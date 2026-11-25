// Thin wrapper around the FastAPI backend (proxied to :8000 in dev).
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail || detail } catch { /* not JSON */ }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json()
}
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) })

export const api = {
  summary: () => request('/summary'),
  students: () => request('/students'),
  student: (id) => request(`/students/${id}`),
  dorm: () => request('/dorm'),
  clusters: () => request('/clusters'),
  setK: (k) => post('/clusters/k', { k }),
  pair: (a, b) => request(`/pair?a=${a}&b=${b}`),
  assign: (body) => post('/assign', body),
  compare: (body) => post('/compare', body),
  swap: (a, b) => post('/swap', { a, b }),
  previewSurvey: (body) => post('/survey/preview', body),
  submitSurvey: (body) => post('/survey', body),
  learn: (body) => post('/learn', body),
  learnResult: () => request('/learn'),
  applyLearned: () => post('/learn/apply'),
  resetLearned: () => post('/learn/reset'),
  generate: (body) => post('/generate', body),
  uploadStudents: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('/upload/students', { method: 'POST', body: fd })
  },
  exportUrl: '/api/export.csv',
}
