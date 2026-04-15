import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider } from './context/SessionContext'
import LandingPage from './pages/LandingPage'
import CapturePage from './pages/CapturePage'
import TagEventPage from './pages/TagEventPage'
import EvidenceReportPage from './pages/EvidenceReportPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/capture" element={<CapturePage />} />
          <Route path="/tag" element={<TagEventPage />} />
          <Route path="/reports/:token" element={<EvidenceReportPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
