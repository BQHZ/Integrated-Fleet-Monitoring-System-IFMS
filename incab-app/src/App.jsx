import { useState } from 'react'
import { useUnitData } from './useUnitData.js'
import LoadingScreen from './displays/LoadingScreen.jsx'
import ErrorDisplay from './displays/ErrorDisplay.jsx'
import HaulTruckDisplay from './displays/HaulTruckDisplay.jsx'
import ExcavatorDisplay from './displays/ExcavatorDisplay.jsx'
import DozerDisplay from './displays/DozerDisplay.jsx'
import GraderDisplay from './displays/GraderDisplay.jsx'
import WaterTruckDisplay from './displays/WaterTruckDisplay.jsx'
import ServiceTruckDisplay from './displays/ServiceTruckDisplay.jsx'
import MiniMap from './shared/MiniMap.jsx'
import InstructionBanner from './shared/InstructionBanner.jsx'
import FeedbackInbox from './shared/FeedbackInbox.jsx'
import TopStrip from './shared/TopStrip.jsx'
import BottomStrip from './shared/BottomStrip.jsx'
import ErrorBoundary from './shared/ErrorBoundary.jsx'
import { ThemeProvider, useTheme } from './shared/theme.jsx'
import { useIncabBus } from './shared/useFeedbackInbox.js'

function chooseDisplay(data) {
  switch (data.unit_type) {
    case 'haul_truck':    return <HaulTruckDisplay data={data} />
    case 'excavator':     return <ExcavatorDisplay data={data} />
    case 'dozer':         return <DozerDisplay data={data} />
    case 'grader':        return <GraderDisplay data={data} />
    case 'water_truck':   return <WaterTruckDisplay data={data} />
    case 'service_truck': return <ServiceTruckDisplay data={data} />
    default:              return <ErrorDisplay error={`Unit type tidak dikenal: ${data.unit_type}`} unitId={data.unit_id} />
  }
}

function computeAlarms(data) {
  if (!data) return []
  return [
    { key: 'fuel_low', label: 'Fuel Low', active: (data.fuel_level_pct || 100) < 20, severity: 'crit' },
    { key: 'coolant', label: 'Coolant High', active: (data.coolant_temp_c || 0) > 100, severity: 'crit' },
    { key: 'oil', label: 'Oil Pressure', active: (data.oil_pressure_bar || 5) < 3.5, severity: 'crit' },
    { key: 'fault', label: 'Engine Fault', active: !!data.fault_code, severity: 'crit' },
    { key: 'overspeed', label: 'Over Speed', active: !!data.speed_violation?.violated, severity: 'warn' },
    { key: 'fatigue', label: 'Fatigue', active: (data.shift_hours_worked || 0) > 7, severity: 'warn' },
    { key: 'nogo', label: 'No-Go Zone', active: !!data.no_go_proximity?.in_zone, severity: 'crit' },
  ]
}

function Shell() {
  const { data, loading, error, unitId } = useUnitData()
  const { palette } = useTheme()
  const {
    instructions, feedback, latestInstruction,
    applyInstructionAck, applyFeedbackAck, clearLatestInstruction,
  } = useIncabBus(unitId)
  const [inboxOpen, setInboxOpen] = useState(false)

  if (loading) return <LoadingScreen unitId={unitId} />
  if (error || !data) return <ErrorDisplay error={error} unitId={unitId} />

  const pendingCount = instructions.filter(i => i.status !== 'ack').length
  const unreadFeedback = feedback.filter(f => f.status !== 'ack').length
  const alarms = computeAlarms(data)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: palette.bg, color: palette.text,
      fontFamily: 'Inter, sans-serif',
    }}>
      <TopStrip
        data={data}
        pendingCount={pendingCount}
        unreadFeedback={unreadFeedback}
        onOpenFeedback={() => setInboxOpen(true)}
      />
      <InstructionBanner
        active={latestInstruction}
        unitId={unitId}
        onAck={applyInstructionAck}
        onDismiss={clearLatestInstruction}
      />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, gap: 8, padding: 8 }}>
        <div style={{
          width: '40%', minWidth: 340, background: '#0a1018',
          borderRadius: 8, overflow: 'hidden', position: 'relative',
        }}>
          <MiniMap data={data} instructions={instructions} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8 }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {chooseDisplay(data)}
          </div>
        </div>
      </div>
      <BottomStrip data={data} alarms={alarms} />

      <FeedbackInbox
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        feedback={feedback}
        unitId={unitId}
        onAck={applyFeedbackAck}
      />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </ErrorBoundary>
  )
}
