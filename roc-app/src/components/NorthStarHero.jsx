import { useEffect, useRef, useState } from 'react'

/**
 * North Star Metric Hero Card — $/BCM ex-fuel (PAMA-controlled).
 * Menggunakan tabel skenario $/BCM:
 *   Lower Bound: $1.10 total → $0.71 ex-fuel (short haul, strip ratio rendah)
 *   Base Case:   $1.80 total → $1.17 ex-fuel (mid-market, strip ratio 8.2x)
 *   Upper Bound: $2.40 total → $1.56 ex-fuel (long haul, strip ratio tinggi)
 *   Fuel pass-through: 35%
 *
 * Props:
 *  - metrics: metricsOverall object (sumber `proxy_usd_per_bcm`, `bcm_cost_scenarios`)
 *  - kpi: production-kpi response (untuk shift elapsed indicator)
 *  - targetUsdPerBcm: target reference ex-fuel (default 1.17 = Base Case)
 */

// Scenario constants (mirror backend BCM_COST_SCENARIOS)
const SCENARIOS = {
  lower_bound: { total: 1.10, fuel_pct: 0.35, ex_fuel: 0.71, label: 'Lower', note: 'Short haul, strip ratio rendah' },
  base_case:   { total: 1.80, fuel_pct: 0.35, ex_fuel: 1.17, label: 'Base',  note: 'Mid-market, strip ratio 8.2x' },
  upper_bound: { total: 2.40, fuel_pct: 0.35, ex_fuel: 1.56, label: 'Upper', note: 'Long haul, strip ratio tinggi' },
}

export default function NorthStarHero({ metrics, kpi, targetUsdPerBcm = 1.17 }) {
  const proxy = metrics?.proxy_usd_per_bcm
  const totalBcm = metrics?.total_bcm_moved || 0
  const activeUnits = metrics?.active_units || 0

  // Use scenarios from backend if available, fallback to local constants
  const scenarios = metrics?.bcm_cost_scenarios || SCENARIOS

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

  // Scenario range for visual indicator
  const lowerEx = scenarios.lower_bound?.ex_fuel || 0.71
  const baseEx = scenarios.base_case?.ex_fuel || 1.17
  const upperEx = scenarios.upper_bound?.ex_fuel || 1.56
  const rangeMin = lowerEx * 0.5   // visual range starts at 50% of lower
  const rangeMax = upperEx * 1.4   // visual range ends at 140% of upper

  // Calculate position of current proxy on the range bar (0-100%)
  const proxyPosition = !isEmpty
    ? Math.min(100, Math.max(0, ((proxy - rangeMin) / (rangeMax - rangeMin)) * 100))
    : null

  // Determine zone color
  const getZoneColor = (val) => {
    if (val == null) return '#64748B'
    if (val <= lowerEx) return '#00875A'          // Excellent — below lower bound
    if (val <= baseEx) return '#0066CC'            // Good — between lower and base
    if (val <= upperEx) return '#F59E0B'           // Warning — between base and upper
    return '#C41E3A'                               // Critical — above upper bound
  }
  const zoneColor = getZoneColor(proxy)
  const getZoneLabel = (val) => {
    if (val == null) return ''
    if (val <= lowerEx) return 'EXCELLENT'
    if (val <= baseEx) return 'GOOD'
    if (val <= upperEx) return 'CAUTION'
    return 'OVER-BUDGET'
  }

  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 100%)',
      border: `1px solid ${onTarget ? '#00875A' : zoneColor}`,
      borderLeft: `8px solid ${onTarget ? '#00875A' : zoneColor}`,
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!isEmpty && (
            <div style={{
              background: zoneColor + '18', color: zoneColor,
              padding: '2px 8px', borderRadius: 4,
              fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
            }}>
              {getZoneLabel(proxy)}
            </div>
          )}
          <div style={{
            background: '#FEF3C7', color: '#92400E',
            padding: '2px 8px', borderRadius: 4,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
          }}>
            BASE CASE · SR 8.2x
          </div>
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
                color: zoneColor,
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
                Target (Base Case)
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

      {/* Scenario Range Bar */}
      {!isEmpty && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 6,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              $/BCM Scenario Range (ex-fuel, 35% fuel pass-through)
            </div>
          </div>
          {/* Range bar */}
          <div style={{
            position: 'relative', height: 22, borderRadius: 11,
            background: 'linear-gradient(90deg, #00875A 0%, #0066CC 35%, #F59E0B 70%, #C41E3A 100%)',
            opacity: 0.15,
          }} />
          <div style={{
            position: 'relative', height: 0, marginTop: -22,
          }}>
            {/* Active bar (filled portion) */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: `${proxyPosition}%`, height: 22, borderRadius: 11,
              background: `linear-gradient(90deg, #00875A 0%, ${zoneColor} 100%)`,
              opacity: 0.3,
              transition: 'width 0.6s ease',
            }} />

            {/* Marker lines for scenarios */}
            {[
              { val: lowerEx, label: `$${lowerEx}`, sub: 'Lower' },
              { val: baseEx, label: `$${baseEx}`, sub: 'Base' },
              { val: upperEx, label: `$${upperEx}`, sub: 'Upper' },
            ].map(({ val, label, sub }) => {
              const pos = ((val - rangeMin) / (rangeMax - rangeMin)) * 100
              return (
                <div key={sub} style={{
                  position: 'absolute', top: 0, left: `${pos}%`,
                  transform: 'translateX(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <div style={{
                    width: 2, height: 22,
                    background: '#475569', opacity: 0.4,
                  }} />
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: '#64748B',
                    marginTop: 2, whiteSpace: 'nowrap', textAlign: 'center',
                  }}>
                    {label}
                    <div style={{ fontSize: 8, fontWeight: 600, color: '#94A3B8' }}>{sub}</div>
                  </div>
                </div>
              )
            })}

            {/* Current value marker */}
            <div style={{
              position: 'absolute', top: -4, left: `${proxyPosition}%`,
              transform: 'translateX(-50%)',
              width: 12, height: 12,
              borderRadius: '50%',
              background: zoneColor,
              border: '2px solid white',
              boxShadow: `0 0 0 2px ${zoneColor}40, 0 2px 4px rgba(0,0,0,0.2)`,
              transition: 'left 0.6s ease',
              zIndex: 2,
            }}>
              {/* Pulsing ring */}
              <div style={{
                position: 'absolute', top: -4, left: -4,
                width: 20, height: 20,
                borderRadius: '50%',
                border: `2px solid ${zoneColor}`,
                animation: 'northstar-pulse 2s ease-in-out infinite',
              }} />
            </div>
          </div>
          {/* Spacer for labels */}
          <div style={{ height: 28 }} />
        </div>
      )}

      {/* Scenario table footnote */}
      <div style={{
        marginTop: 8, paddingTop: 10,
        borderTop: '1px dashed #E2E8F0',
        fontSize: 10, color: '#94A3B8', letterSpacing: '0.02em',
      }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#64748B', fontWeight: 700 }}>Skenario $/BCM:</span>
          <span>
            <span style={{ color: '#00875A', fontWeight: 700 }}>Lower</span>{' '}
            $1.10 total → $0.71 ex-fuel
          </span>
          <span style={{ color: '#CBD5E1' }}>│</span>
          <span>
            <span style={{ color: '#0066CC', fontWeight: 700 }}>Base</span>{' '}
            $1.80 total → $1.17 ex-fuel
          </span>
          <span style={{ color: '#CBD5E1' }}>│</span>
          <span>
            <span style={{ color: '#F59E0B', fontWeight: 700 }}>Upper</span>{' '}
            $2.40 total → $1.56 ex-fuel
          </span>
          <span style={{ color: '#CBD5E1' }}>│</span>
          <span style={{ color: '#64748B' }}>
            Fuel pass-through: 35%
          </span>
        </div>
        {!isEmpty && (
          <div style={{ marginTop: 4, color: '#64748B' }}>
            <strong>Cost basis:</strong>{' '}
            Base ex-fuel ${baseEx}/BCM × efficiency factor (100% ÷ utilization%) — {' '}
            {totalBcm.toFixed(1)} BCM moved · {activeUnits} active units
          </div>
        )}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes northstar-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.8); }
        }
      `}</style>
    </div>
  )
}
