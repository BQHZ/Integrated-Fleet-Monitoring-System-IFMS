import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const from = location.state?.from || '/'

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Login gagal'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '32px 36px',
        width: 380, boxShadow: '0 10px 40px rgba(15, 23, 42, 0.08)',
        border: '1px solid #E2E8F0',
      }}>
        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 12px', borderRadius: 12,
            background: '#1e3a5f', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 24,
          }}>
            PAMA
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#1e293b' }}>
            Fleet Operations Center
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            Remote Operations Center · v3
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
            Username
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin / dispatcher.mtbu / dispatcher.adro"
              style={inputStyle}
              required
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </label>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5',
              color: '#991B1B', borderRadius: 6, padding: '8px 12px', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              marginTop: 8, background: '#0066CC', color: '#fff', border: 'none',
              borderRadius: 6, padding: '10px 14px', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !username || !password ? 0.6 : 1,
            }}
          >
            {loading ? 'Memverifikasi...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: 20, padding: '10px 12px', background: '#F8FAFC',
          borderRadius: 6, fontSize: 11, color: '#64748B', lineHeight: 1.6,
        }}>
          <strong style={{ color: '#475569' }}>Demo credentials:</strong><br />
          admin / admin123 · dispatcher.mtbu / mtbu123 · dispatcher.adro / adro123
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  marginTop: 6, padding: '8px 12px', fontSize: 13,
  border: '1px solid #CBD5E1', borderRadius: 6, outline: 'none',
  fontFamily: 'inherit',
}
