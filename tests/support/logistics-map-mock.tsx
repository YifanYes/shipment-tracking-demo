import type { LogisticsMapProps } from '@/features/overview/components/logistics-map'

/** Stands in for the WebGL map with the same inputs and selection contract. */
export default function LogisticsMapMock({
  shipments,
  sites,
  selected,
  selectedSiteId,
  onSelect,
  onSiteSelect,
}: LogisticsMapProps) {
  return (
    <div data-testid="map">
      {sites.map((site) => (
        <button
          key={site.id}
          data-kind={site.kind}
          aria-pressed={selectedSiteId === site.id}
          onClick={() => onSiteSelect(selectedSiteId === site.id ? null : site.id)}
        >
          Filtrar envíos por {site.name}
        </button>
      ))}
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
