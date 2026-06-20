import { useUnitData } from './useUnitData.js'
import LoadingScreen from './displays/LoadingScreen.jsx'
import ErrorDisplay from './displays/ErrorDisplay.jsx'
import HaulTruckDisplay from './displays/HaulTruckDisplay.jsx'
import ExcavatorDisplay from './displays/ExcavatorDisplay.jsx'
import DozerDisplay from './displays/DozerDisplay.jsx'
import GraderDisplay from './displays/GraderDisplay.jsx'
import WaterTruckDisplay from './displays/WaterTruckDisplay.jsx'
import ServiceTruckDisplay from './displays/ServiceTruckDisplay.jsx'

export default function App() {
  const { data, loading, error, unitId } = useUnitData()

  if (loading) return <LoadingScreen unitId={unitId} />
  if (error || !data) return <ErrorDisplay error={error} unitId={unitId} />

  switch (data.unit_type) {
    case 'haul_truck':
      return <HaulTruckDisplay data={data} />
    case 'excavator':
      return <ExcavatorDisplay data={data} />
    case 'dozer':
      return <DozerDisplay data={data} />
    case 'grader':
      return <GraderDisplay data={data} />
    case 'water_truck':
      return <WaterTruckDisplay data={data} />
    case 'service_truck':
      return <ServiceTruckDisplay data={data} />
    default:
      return <ErrorDisplay error={`Unit type tidak dikenal: ${data.unit_type}`} unitId={unitId} />
  }
}
