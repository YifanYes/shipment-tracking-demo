import { describe, expect, it } from 'vitest'
import { demoSeed } from '@/data/scenarios'
import { shipmentChanges } from '@/domain/changes'
import { selectVisibleShipments } from '@/domain/selectors'
import { applyScheduledEvents, nextDemoStep } from '@/simulation/clock'

const { dataset, scenarios, steps } = demoSeed
const step = (identityId: string, index: number) => {
  let current = dataset
  let cutoffAt = dataset.referenceTime
  let before = selectVisibleShipments({ dataset, identityId, cutoffAt, selectedShipmentId: null })
  for (let i = 0; i <= index; i++) {
    before = selectVisibleShipments({
      dataset: current,
      identityId,
      cutoffAt,
      selectedShipmentId: null,
    })
    cutoffAt = nextDemoStep(current, steps, cutoffAt)!.at
    current = applyScheduledEvents(current, scenarios, cutoffAt)
  }
  const after = selectVisibleShipments({
    dataset: current,
    identityId,
    cutoffAt,
    selectedShipmentId: null,
  })
  return shipmentChanges(before, after)
}

describe('resumen de cada paso', () => {
  it('recoge las incidencias, ETA y entregas que cambian', () => {
    const delay = step('operations-network', 1)
    expect(delay.opened).toContainEqual({ reference: 'ATL-IT-003', kind: 'delay' })
    expect(delay.etaChanged.map((item) => item.reference)).toContain('ATL-IT-003')
    const release = step('operations-network', 4)
    expect(release.cleared).toContainEqual({ reference: 'ATL-TR-004', kind: 'customs' })
    const deliveries = step('operations-network', 5)
    expect(deliveries.delivered).toEqual(expect.arrayContaining(['ATL-MA-002', 'ATL-TR-004']))
  })

  it('no menciona envíos fuera del perímetro', () => {
    const changes = step('customer-norte', 1)
    const references = [
      ...changes.delivered,
      ...changes.opened.map((item) => item.reference),
      ...changes.cleared.map((item) => item.reference),
      ...changes.etaChanged.map((item) => item.reference),
    ]
    expect(references).not.toContain('ATL-IT-003')
  })
})
