import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useFleetSocket } from './useFleetSocket.js'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import FleetOverview from './pages/FleetOverview.jsx'
import DispatchBoard from './pages/DispatchBoard.jsx'
import SafetyMonitor from './pages/SafetyMonitor.jsx'
import Maintenance from './pages/Maintenance.jsx'
import ShiftReport from './pages/ShiftReport.jsx'

function Layout() {
  const location = useLocation()
  const [siteFilter, setSiteFilter] = useState('all')
  const { units, metricsOverall, metricsBySite, alerts, safetyEvents, dispatch, connected } = useFleetSocket()

  const pageProps = { units, metricsOverall, metricsBySite, alerts, safetyEvents, dispatch, siteFilter }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar connected={connected} />
      <div style={{ flex: 1, marginLeft: 220, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <TopBar
          pathname={location.pathname}
          siteFilter={siteFilter}
          onSiteFilter={setSiteFilter}
        />
        <main style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<FleetOverview {...pageProps} />} />
            <Route path="/dispatch" element={<DispatchBoard {...pageProps} />} />
            <Route path="/safety" element={<SafetyMonitor {...pageProps} />} />
            <Route path="/maintenance" element={<Maintenance {...pageProps} />} />
            <Route path="/report" element={<ShiftReport {...pageProps} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}
