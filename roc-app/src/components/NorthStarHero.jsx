import { useEffect, useRef, useState } from 'react'

/**
 * North Star Metric Hero Card — $/BCM ex-fuel (PAMA-controlled).
 * Bukan salah satu dari banyak KPI: dia anchor ekonomi utama kompetisi.
 * Props:
 *  - metrics: metricsOverall object (sumber `proxy_usd_per_bcm`)
 *  - kpi: production-kpi response (untuk shift elapsed indicator)
 *  - targetUsdPerBcm: target reference (default 0.50)
 */
export default function NorthStarHero({ metrics, kpi, targetUsdPerBcm = 0.50 }) {
  const proxy = metrics?.proxy_usd_per_bcm
  const totalBcm = metrics?.total_bcm_moved || 0
  const activeUnits = metrics?.active_units || 0

  // Baseline trend: snapshot nilai proxy pertama di shift ini (per-session)
  const baselineRef = useRef(null)
  const [, force] = useState(0)
  useEffect(() => {
    if (proxy != null && proxy > 0 && baselineRef.current == null) {
      // Coba ambil dari sessionStorage (tahan refresh dalam 1 shift)
      const stored = sessionStorage.getItem('pama_proxy_baseline')
      if (stored) {
        baselineRef.current = parseFloat(stored)
      } else {
        baselineRef.current = proxy
        sessionStorage.setItem('pama_proxy_baseline', String(proxy))
      }
      force(n => n + 1)
    }
  }, [proxy])

  const baseline = baselineRef.current
  const hasTrend = baseline != null && proxy != null && proxy > 0 && baseline > 0
  const trendPct = hasTrend ? ((proxy - baseline) / baseline) * 100 : 0
  const trendDirection = trendPct < -0.5 ? 'down' : trendPct > 0.5 ? 'up' : 'flat'
  // Untuk biaya: turun = lebih efisien = HIJAU. Naik = lebih boros = MERAH.
  const trendColor = trendDirection === 'down' ? '#00875A' : trendDirection === 'up' ? '#C41E3A' : '#64748B'
  const trendArrow = trendDirection === 'down' ? '↓' : trendDirection === 'up' ? '↑' : '→'

  // Empty state — proxy belum bisa dihitung
  const isEmpty = proxy == null || proxy === 0 || totalBcm === 0

  // Status vs target — di bawah / di atas
  const vsTarget = !isEmpty ? proxy - targetUsdPerBcm : null
  const onTarget = !isEmpty && proxy < targetUsdPerBcm

  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 100%)',
      border: `1px solid ${onTarget ? '#00875A' : '#0066CC'}`,
      borderLeft: `8px solid ${onTarget ? '#00875A' : '#0066CC'}`,
      borderRadius: 10,
      padding: '18px 24px',
      boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
    }}>
      {/* Label kategori atas */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: '#475569',
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          ★ North Star Metric
        </div>
        <div style={{
          background: '#FEF3C7', color: '#92400E',
          padding: '2px 8px', borderRadius: 4,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
        }}>
          [ASUMSI MVS]
        </div>
      </div>

      {/* Value row utama */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap',
      }}>
        {isEmpty ? (
          <div style={{
            fontSize: 28, fontWeight: 700, color: '#64748B', lineHeight: 1.1,
            fontStyle: 'italic',
          }}>
            Calculating…
            <div style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8', marginTop: 4, fontStyle: 'normal' }}>
              need ≥1 completed cycle
            </div>
          </div>
        ) : (
          <>
            {/* Angka utama */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{
                fontSize: 52, fontWeight: 900,
                color: onTarget ? '#00875A' : '#0066CC',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                letterSpacing: '-0.02em',
              }}>
                ${proxy.toFixed(2)}
                <span style={{ fontSize: 22, fontWeight: 700, color: '#475569', marginLeft: 6 }}>
                  /BCM
                </span>
              </div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: '#64748B', marginTop: 4,
              }}>
                (ex-fuel, PAMA-controlled)
              </div>
            </div>

            {/* Target reference */}
            <div style={{
              borderLeft: '1px solid #CBD5E1', paddingLeft: 18,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#64748B',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Target
              </div>
              <div style={{
                fontSize: 24, fontWeight: 800, color: '#1e293b',
                fontVariantNumeric: 'tabular-nums',
              }}>
                &lt; ${targetUsdPerBcm.toFixed(2)}<span style={{ fontSize: 14, color: '#64748B' }}>/BCM</span>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: onTarget ? '#00875A' : '#C41E3A',
              }}>
                {onTarget
                  ? `✓ ${Math.abs(vsTarget).toFixed(2)} below target`
                  : `△ +${vsTarget.toFixed(2)} above target`}
              </div>
            </div>

            {/* Trend indicator */}
            {hasTrend && (
              <div style={{
                borderLeft: '1px solid #CBD5E1', paddingLeft: 18,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#64748B',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Trend (shift)
                </div>
                <div style={{
                  fontSize: 24, fontWeight: 800, color: trendColor,
                  fontVariantNumeric: 'tabular-nums',
                  display: 'flex', alignItems: 'baseline', gap: 4,
                }}>
                  <span style={{ fontSize: 28 }}>{trendArrow}</span>
                  {Math.abs(trendPct).toFixed(1)}%
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  baseline ${baseline.toFixed(2)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footnote rumus */}
      <div style={{
        marginTop: 12, paddingTop: 10,
        borderTop: '1px dashed #E2E8F0',
        fontSize: 10, color: '#94A3B8', letterSpacing: '0.02em',
      }}>
        <strong style={{ color: '#64748B' }}>Cost basis:</strong>{' '}
        {activeUnits} unit × $45/hr × elapsed hours ÷ total BCM moved
        {!isEmpty && (
          <span style={{ marginLeft: 12, color: '#64748B' }}>
            ({totalBcm.toFixed(1)} BCM moved this shift)
          </span>
        )}
      </div>
    </div>
  )
}
