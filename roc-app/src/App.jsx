import { useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useFleetSocket } from './useFleetSocket.js'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import FleetOverview from './pages/FleetOverview.jsx'
import DispatchBoard from './pages/DispatchBoard.jsx'
import SafetyMonitor from './pages/SafetyMonitor.jsx'
import Maintenance from './pages/Maintenance.jsx'
import ShiftReport from './pages/ShiftReport.jsx'
import Login from './pages/Login.jsx'
import UserManagement from './pages/admin/UserManagement.jsx'
import FleetMaster from './pages/admin/FleetMaster.jsx'
import Geofence from './pages/admin/Geofence.jsx'
import AuditLog from './pages/admin/AuditLog.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import RouteGuard from './auth/RouteGuard.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

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
            <Route path="/admin/users" element={<RouteGuard role="super_admin"><UserManagement /></RouteGuard>} />
            <Route path="/admin/fleet" element={<RouteGuard role="super_admin"><FleetMaster /></RouteGuard>} />
            <Route path="/admin/geofences" element={<RouteGuard role="super_admin"><Geofence /></RouteGuard>} />
            <Route path="/admin/audit" element={<RouteGuard role="super_admin"><AuditLog /></RouteGuard>} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function AppRoutes() {
  const navigate = useNavigate()
  const handleUnauthorized = useCallback(() => {
    navigate('/login', { replace: true })
  }, [navigate])

  return (
    <AuthProvider onUnauthorized={handleUnauthorized}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <RouteGuard>
            <Layout />
          </RouteGuard>
        } />
      </Routes>
    </AuthProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
