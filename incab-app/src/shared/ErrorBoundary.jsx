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
    console.error('[in-cab] caught:', error, info)
  }
  reset = () => this.setState({ error: null })
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          background: '#0F172A', color: '#F1F5F9', padding: 40,
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ fontSize: 40 }}>⚠</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>In-Cab Error</div>
          <div style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', maxWidth: 480 }}>
            Aplikasi mengalami error tak terduga. Cek koneksi backend & restart device.
          </div>
          <pre style={{
            background: '#1E293B', padding: 12, borderRadius: 6, fontSize: 11,
            color: '#FCA5A5', maxWidth: 520, overflow: 'auto',
          }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button onClick={this.reset} style={{
            background: '#06B6D4', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}
