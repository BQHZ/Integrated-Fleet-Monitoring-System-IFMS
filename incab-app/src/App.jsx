import { useState, useCallback } from 'react'
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

export default function App() {
  const { data, loading, error, unitId } = useUnitData()
  const [instructions, setInstructions] = useState([])
  const onInstructionsChange = useCallback(setInstructions, [])

  if (loading) return <LoadingScreen unitId={unitId} />
  if (error || !data) return <ErrorDisplay error={error} unitId={unitId} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC' }}>
      <InstructionBanner unitId={unitId} onInstructionsChange={onInstructionsChange} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: '40%', minWidth: 320, background: '#1e293b', position: 'relative' }}>
          <MiniMap data={data} instructions={instructions} />
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {chooseDisplay(data)}
        </div>
      </div>
    </div>
  )
}
