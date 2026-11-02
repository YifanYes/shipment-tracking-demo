import type { ShipmentView } from '@/domain/contracts'

/** Stands in for the WebGL map with the same inputs and selection contract. */
export default function LogisticsMapMock({
  shipments,
  selected,
  onSelect,
}: {
  shipments: ShipmentView[]
  selected: ShipmentView | null
  onSelect: (id: string) => void
}) {
  return (
    <div data-testid="map">
      {shipments.map(({ shipment, projection }) => (
        <button
          key={shipment.id}
          data-stage={projection.currentStage}
          aria-pressed={selected?.shipment.id === shipment.id}
          onClick={() => onSelect(shipment.id)}
        >
          Marcador {shipment.reference}
        </button>
      ))}
    </div>
  )
}
