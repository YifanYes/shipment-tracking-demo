import { describe, expect, it } from 'vitest'
import { demoSeed } from '@/data/scenarios'
import { buildLogisticsReport, defaultAnalyticsFilters } from '@/domain/analytics'
import { selectVisibleShipments } from '@/domain/selectors'

const { dataset } = demoSeed
const cutoffAt = dataset.referenceTime
const views = (identityId: string) =>
  selectVisibleShipments({ dataset, identityId, cutoffAt, selectedShipmentId: null })

describe('perímetro del dataset completo', () => {
  it('ninguna identidad ve envíos, documentos, incidencias ni métricas ajenos', () => {
    for (const identity of dataset.identities) {
      const visible = views(identity.id)
      expect(visible.length).toBeGreaterThan(0)
      const allowed = (shipment: (typeof dataset.shipments)[number]) =>
        identity.role === 'customer'
          ? shipment.accountId === identity.accountId
          : identity.allowedOriginSiteIds.includes(shipment.originSiteId) &&
            identity.allowedAccountIds.includes(shipment.accountId)
      expect(visible.map((view) => view.shipment.id).sort()).toEqual(
        dataset.shipments
          .filter(allowed)
          .map((shipment) => shipment.id)
          .sort(),
      )
      const ids = new Set(visible.map((view) => view.shipment.id))
      for (const view of visible) {
        expect(view.documents.every((item) => item.shipmentId === view.shipment.id)).toBe(true)
        expect(view.events.every((item) => item.shipmentId === view.shipment.id)).toBe(true)
        expect(view.incidents.every((item) => item.shipmentId === view.shipment.id)).toBe(true)
      }
      const report = buildLogisticsReport({
        identityId: identity.id,
        shipments: visible,
        filters: defaultAnalyticsFilters(cutoffAt),
        cutoffAt,
        datasetRevision: dataset.revision,
      })
      expect(
        report.metrics.flatMap((metric) => metric.shipmentIds).every((id) => ids.has(id)),
      ).toBe(true)
    }
  })

  it('la demo empieza con toda la red y operaciones Madrid solo ve su centro', () => {
    expect(dataset.identities[0]!.id).toBe('operations-network')
    expect(
      views('operations-madrid').every((view) => view.shipment.originSiteId === 'site-madrid'),
    ).toBe(true)
    expect(views('operations-network')).toHaveLength(dataset.shipments.length)
  })

  it('reutiliza las vistas mientras no cambian dataset, identidad ni fecha de corte', () => {
    const state = { dataset, identityId: 'customer-norte', cutoffAt, selectedShipmentId: null }
    expect(selectVisibleShipments({ ...state, selectedShipmentId: 'x' })).toBe(
      selectVisibleShipments(state),
    )
  })
})
