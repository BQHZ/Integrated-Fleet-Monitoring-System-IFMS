import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[roc] caught:', error, info)
  }
  reset = () => this.setState({ error: null })
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          background: '#F8FAFC', color: '#1E293B', padding: 40,
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ fontSize: 44 }}>⚠</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>ROC Application Error</div>
          <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', maxWidth: 480 }}>
            Halaman mengalami error tak terduga. Coba refresh atau login ulang.
          </div>
          <pre style={{
            background: '#FEE2E2', color: '#991B1B', padding: 12, borderRadius: 6,
            fontSize: 11, maxWidth: 600, overflow: 'auto',
          }}>{String(this.state.error?.message || this.state.error)}</pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={this.reset} style={{
              background: '#0066CC', color: '#fff', border: 'none', borderRadius: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Retry</button>
            <button onClick={() => window.location.href = '/login'} style={{
              background: '#fff', color: '#475569', border: '1px solid #CBD5E1',
              borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Re-login</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
