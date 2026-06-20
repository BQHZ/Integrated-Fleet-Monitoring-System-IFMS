export default function ErrorDisplay({ error, unitId }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#FFF5F5', gap: 16, padding: 24,
    }}>
      <div style={{ fontSize: 48, color: '#C41E3A' }}>⚠</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#C41E3A' }}>Koneksi Gagal</div>
      <div style={{ fontSize: 14, color: '#475569', textAlign: 'center', maxWidth: 400 }}>
        {error || 'Unit tidak ditemukan'}
      </div>
      <div style={{ fontSize: 13, color: '#94A3B8' }}>Unit: <strong>{unitId}</strong></div>
      <div style={{
        background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8,
        padding: '10px 16px', fontSize: 13, color: '#991B1B', textAlign: 'center',
      }}>
        Mencoba ulang setiap 3 detik...
      </div>
      <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 8 }}>
        Gunakan URL: ?unit=DT-A01 untuk ganti unit
      </div>
    </div>
  )
}
