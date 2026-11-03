import { describe, expect, it } from 'vitest'
import type { DemoIdentity, OperatorEvent } from '@/domain/contracts'
import { normalizeEvent, shipmentEvents } from '@/domain/events'
import { projectShipment } from '@/domain/projection'
import { canViewShipment } from '@/domain/visibility'
import { nationalDataset, nationalScenario } from '@/data/scenarios/national'

const shipment = nationalDataset.shipments[0]!
const transit = nationalDataset.events[1]!
const delivered = nationalScenario.scheduledEvents[0]!.event
const project = (events: readonly OperatorEvent[], cutoffAt = '2026-10-31T12:00:00.000Z') =>
  projectShipment({ ...nationalDataset, events }, shipment, cutoffAt)

describe('perímetro y selección', () => {
  it('exige centro y cuenta a operaciones, y cuenta exacta al cliente', () => {
    const operations = nationalDataset.identities[0]!
    expect(canViewShipment(operations, shipment)).toBe(true)
    expect(canViewShipment(nationalDataset.identities[1]!, shipment)).toBe(false)
    const customer: DemoIdentity = {
      id: 'owner',
      name: 'Cliente propietario',
      role: 'customer',
      accountId: shipment.accountId,
    }
    expect(canViewShipment(customer, shipment)).toBe(true)
    for (const [allowedOriginSiteIds, allowedAccountIds] of [
      [[], [shipment.accountId]],
      [[shipment.originSiteId], []],
      [['other'], [shipment.accountId]],
      [[shipment.originSiteId], ['other']],
    ]) {
      expect(
        canViewShipment(
          {
            id: 'limited',
            name: 'Limitado',
            role: 'operations',
            allowedOriginSiteIds: allowedOriginSiteIds!,
            allowedAccountIds: allowedAccountIds!,
          },
          shipment,
        ),
      ).toBe(false)
    }
  })
})

describe('hechos y proyección compartida', () => {
  it('conserva fuente de ETA y ubicación sin convertir la animación en un hecho', () => {
    const result = project(nationalDataset.events, nationalDataset.referenceTime)
    expect(result).toMatchObject({
      lifecycle: 'active',
      currentStage: 'in_transit',
      freshness: 'current',
      lastConfirmedLocation: { locationId: 'waypoint-a3-perales', evidence: { id: transit.id } },
    })
    expect(result.eta).toEqual({
      kind: 'operator',
      arrivalAt: '2026-10-31T12:00:00.000Z',
      issuedAt: transit.occurredAt,
      operatorId: transit.operatorId,
      evidence: [{ kind: 'operator_event', id: transit.id }],
    })
  })

  it('no inventa progreso, ubicación ni ETA para un código desconocido', () => {
    const unknown = {
      ...transit,
      id: 'unknown',
      rawCode: 'MYSTERY',
      locationId: 'destination-valencia',
    }
    expect(normalizeEvent(unknown).mapping).toBe('unknown')
    expect(normalizeEvent({ ...transit, operatorId: 'other-operator' }).mapping).toBe('unknown')
    expect(project([unknown])).toMatchObject({
      lifecycle: 'planned',
      currentStage: 'planned',
      eta: { kind: 'unavailable' },
      lastConfirmedLocation: null,
      unknownEventIds: ['unknown'],
    })
  })

  it('ordena por fecha del hecho, deduplica IDs y no retrocede por un evento tardío', () => {
    const lateOldEvent = { ...transit, receivedAt: delivered.receivedAt }
    const result = project([delivered, lateOldEvent, delivered, nationalDataset.events[0]!])
    expect(result).toMatchObject({
      lifecycle: 'delivered',
      currentStage: 'completed',
      lastConfirmedLocation: { locationId: 'destination-valencia' },
    })
    expect(
      shipmentEvents(
        { ...nationalDataset, events: [delivered, lateOldEvent, delivered] },
        shipment,
        delivered.receivedAt,
      ).map((event) => event.id),
    ).toEqual([transit.id, delivered.id])
    const laterRegression = {
      ...transit,
      id: 'regression',
      occurredAt: '2026-10-31T13:00:00.000Z',
      receivedAt: '2026-10-31T13:00:00.000Z',
    }
    expect(project([delivered, laterRegression], laterRegression.receivedAt).currentStage).toBe(
      'completed',
    )
  })

  it('no muestra hechos futuros ni eventos todavía no recibidos', () => {
    const notReceived = { ...delivered, occurredAt: '2026-10-31T09:45:00.000Z' }
    expect(
      project([...nationalDataset.events, delivered, notReceived], nationalDataset.referenceTime)
        .currentStage,
    ).toBe('in_transit')
  })

  it('excluye eventos de otro tramo u operador', () => {
    expect(
      project([
        { ...delivered, legId: 'other' },
        { ...delivered, operatorId: 'other' },
      ]).lifecycle,
    ).toBe('planned')
  })

  it('separa antigüedad y ETA de la fecha comprometida', () => {
    expect(project([], nationalDataset.referenceTime)).toMatchObject({
      freshness: 'no_data',
      eta: { kind: 'unavailable' },
    })
    expect(project(nationalDataset.events, '2026-10-31T15:00:00.000Z')).toMatchObject({
      currentStage: 'in_transit',
      freshness: 'stale',
    })
    expect(project([{ ...transit, payload: { arrivalAt: 'bad-date' } }]).eta.kind).toBe(
      'unavailable',
    )
    expect(shipment.committedDeliveryAt).toBe('2026-10-31T14:00:00.000Z')
  })
})

describe('eventos con fecha inválida', () => {
  it('se ignoran y no entregan el envío', () => {
    const base = nationalDataset.events.at(-1)!
    const invalid = { ...base, id: 'event-invalid', rawCode: 'DELIVERED', occurredAt: 'nope' }
    expect(project([...nationalDataset.events, invalid]).lifecycle).not.toBe('delivered')
  })
})
