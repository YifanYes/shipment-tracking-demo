import { lazy, Suspense, useMemo } from 'react'
import { LocateFixed } from 'lucide-react'
import type { ShipmentView } from '@/domain/contracts'
import { ErrorBoundary } from '@/shared/ui/error-boundary'
import { networkSites } from '../lib/network'

const LogisticsMap = lazy(() => import('./logistics-map'))

const ignore = () => {}

/** The route and last confirmed location of one shipment, for both roles. */
export function ShipmentRouteMap({ item, cutoffAt }: { item: ShipmentView; cutoffAt: string }) {
  const shipments = useMemo(() => [item], [item])
  const sites = useMemo(() => networkSites(shipments), [shipments])
  return (
    <section className="shipment-route-map" aria-label={`Ruta de ${item.shipment.reference}`}>
      <div className="map-surface">
        <div className="logistics-map-frame">
          <ErrorBoundary
            fallback={
              <output className="map-unavailable">
                <LocateFixed size={26} aria-hidden="true" />
                <strong>El mapa no está disponible</strong>
              </output>
            }
          >
            <Suspense fallback={<output className="map-loading">Cargando mapa…</output>}>
              <LogisticsMap
                shipments={shipments}
                sites={sites}
                selected={item}
                selectedSiteId={null}
                cutoffAt={cutoffAt}
                onSelect={ignore}
                onClusterSelect={ignore}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </section>
  )
}
