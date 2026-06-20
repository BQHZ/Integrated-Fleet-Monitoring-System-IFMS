export default function LoadingScreen({ unitId }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#fff', gap: 20,
    }}>
      <div style={{
        width: 48, height: 48, border: '4px solid #E2E8F0',
        borderTop: '4px solid #0066CC', borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a5f' }}>PAMA In-Cab</div>
      <div style={{ fontSize: 14, color: '#64748B' }}>
        Menghubungkan ke unit <strong>{unitId}</strong>...
      </div>
      <div style={{ fontSize: 12, color: '#94A3B8' }}>Pastikan backend sudah berjalan di port 8000</div>
    </div>
  )
}
