import { nationalDataset } from '@/data/scenarios/national'
import { selectVisibleShipments } from '@/domain/selectors'

export const cutoffAt = nationalDataset.referenceTime

/** The national shipment as seen by the operations identity at the reference time. */
export const operationsShipment = selectVisibleShipments({
  dataset: nationalDataset,
  identityId: 'operations-madrid',
  cutoffAt,
  selectedShipmentId: null,
})[0]!
