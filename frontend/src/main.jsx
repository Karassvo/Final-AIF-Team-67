import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { I18nProvider } from './i18n'
import Layout from './components/Layout'
import { Loader } from './components/ui'
import Home from './pages/Home'

const Survey = lazy(() => import('./pages/Survey'))
const Dorm = lazy(() => import('./pages/Dorm'))
const Types = lazy(() => import('./pages/Types'))
const Pair = lazy(() => import('./pages/Pair'))
const Lab = lazy(() => import('./pages/Lab'))
const StudentPage = lazy(() => import('./pages/Student'))

try {
  if (localStorage.getItem('rm.theme') === 'dark') document.documentElement.classList.add('dark')
} catch { /* storage unavailable */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="survey" element={<Survey />} />
              <Route path="dorm" element={<Dorm />} />
              <Route path="types" element={<Types />} />
              <Route path="pair" element={<Pair />} />
              <Route path="lab" element={<Lab />} />
              <Route path="student/:id" element={<StudentPage />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
)
