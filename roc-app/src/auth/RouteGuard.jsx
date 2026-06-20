import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function RouteGuard({ children, role }) {
  const { isAuthenticated, hasRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role && !hasRole(role)) {
    // Dispatcher buka /admin/* → redirect ke / dengan flag forbidden
    return <Navigate to="/" replace state={{ forbidden: true, attemptedPath: location.pathname }} />
  }

  return children
}
