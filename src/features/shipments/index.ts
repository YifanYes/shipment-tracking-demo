import './shipments.css'

export { ShipmentDetail } from './components/shipment-detail'
export { ShipmentList } from './components/shipment-list'
// Presentation helpers shared with the customer view.
export {
  customerStatus,
  delayExplanation,
  delayMinutes,
  deliveredAt,
  etaKindLabels,
  etaValue,
  expectedArrival,
  formatDuration,
  legModesLabel,
  type Audience,
} from './lib/presentation'
