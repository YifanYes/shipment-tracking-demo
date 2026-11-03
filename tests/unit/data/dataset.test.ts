import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDemoSeed, demoSeed, nationalSeed } from '@/data/scenarios'
import { nationalDataset } from '@/data/scenarios/national'
import { selectVisibleShipments } from '@/domain/selectors'

const { dataset } = demoSeed
const views = selectVisibleShipments({
  dataset,
  identityId: 'operations-network',
  cutoffAt: dataset.referenceTime,
  selectedShipmentId: null,
})

describe('dataset de la demo', () => {
  it('se genera de forma determinista', () => {
    expect(buildDemoSeed()).toEqual(demoSeed)
    expect(dataset.referenceTime).toBe('2026-10-31T10:00:00.000Z')
    expect(nationalSeed.dataset).toBe(nationalDataset)
  })

  it('reúne envíos activos e históricos de tres cuentas, centros y cuatro operadores', () => {
    const history = views.filter((view) => view.shipment.id.startsWith('shipment-h-'))
    const current = views.filter((view) => !view.shipment.id.startsWith('shipment-h-'))
    expect(history).toHaveLength(150)
    expect(history.every((view) => view.projection.lifecycle === 'delivered')).toBe(true)
    expect(current).toHaveLength(24)
    expect(current.every((view) => view.projection.lifecycle !== 'delivered')).toBe(true)
    const oldest = Math.min(...history.map((view) => Date.parse(view.shipment.createdAt)))
    expect(Date.parse(dataset.referenceTime) - oldest).toBeLessThanOrEqual(90 * 86_400_000)
    expect(new Set(dataset.shipments.map((item) => item.accountId)).size).toBe(3)
    expect(new Set(dataset.shipments.map((item) => item.originSiteId)).size).toBe(3)
    expect(dataset.operators).toHaveLength(4)
    const modes = new Set(
      current.map((view) => view.shipment.legs.map((leg) => leg.mode).join('+')),
    )
    expect(modes).toEqual(new Set(['road', 'road+sea+road']))
  })

  it('conserva el envío nacional de la fase 1 con sus eventos', () => {
    const national = nationalDataset.shipments[0]!
    expect(dataset.shipments).toContainEqual(national)
    for (const event of nationalDataset.events) expect(dataset.events).toContainEqual(event)
  })

  it('mantiene referencias, coordenadas, rutas y documentos coherentes', () => {
    const ids = (items: readonly { id: string }[]) => items.map((item) => item.id)
    for (const list of [dataset.shipments, dataset.documents, dataset.locations])
      expect(new Set(ids(list)).size).toBe(list.length)
    const locations = new Map(dataset.locations.map((item) => [item.id, item]))
    expect([...locations.values()].every((item) => item.coordinates)).toBe(true)
    for (const event of dataset.events) {
      const shipment = dataset.shipments.find((item) => item.id === event.shipmentId)!
      const leg = shipment.legs.find((item) => item.id === event.legId)!
      expect(leg.operatorId).toBe(event.operatorId)
      if (event.locationId) expect(locations.has(event.locationId)).toBe(true)
      expect(Date.parse(event.receivedAt)).toBeGreaterThanOrEqual(Date.parse(event.occurredAt))
    }
    for (const view of views.filter((item) => item.projection.lifecycle !== 'delivered'))
      for (const leg of view.shipment.legs)
        expect(leg.route?.source).toBe(
          leg.mode === 'road' ? 'OSRM · OpenStreetMap' : 'Itinerario sintético del operador',
        )
    for (const document of dataset.documents) {
      expect(
        dataset.shipments.find((item) => item.id === document.shipmentId)?.documentIds,
      ).toContain(document.id)
      if (document.state === 'missing') expect(document.resourcePath).toBeUndefined()
      else expect(existsSync(`public${document.resourcePath}`)).toBe(true)
    }
  })

  it('incluye códigos pendientes de clasificar y escenarios multimodales', () => {
    expect(views.some((view) => view.projection.unknownEventIds.length)).toBe(true)
    expect(dataset.documents.some((item) => item.state === 'missing')).toBe(true)
  })
})
