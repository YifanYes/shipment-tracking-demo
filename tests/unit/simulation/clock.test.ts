import { describe, expect, it } from 'vitest'
import type { DemoDataset } from '@/domain/contracts'
import { buildDemoSeed, demoSeed } from '@/data/scenarios'
import { selectVisibleShipments } from '@/domain/selectors'
import { applyScheduledEvents, nextScheduledAt } from '@/simulation/clock'

const { dataset, scenarios } = demoSeed
const scenarioIds = scenarios.flatMap((scenario) => scenario.shipmentIds)

function walk(seed = demoSeed) {
  let current: DemoDataset = seed.dataset
  let cutoffAt = seed.dataset.referenceTime
  const steps: string[] = []
  for (let next = nextScheduledAt(current, seed.scenarios, cutoffAt); next;) {
    current = applyScheduledEvents(current, seed.scenarios, next)
    cutoffAt = next
    steps.push(next)
    next = nextScheduledAt(current, seed.scenarios, cutoffAt)
  }
  return { dataset: current, cutoffAt, steps }
}

describe('reloj de la demo', () => {
  it('libera cada evento programado cuando se recibe y en orden', () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'national-on-time',
      'international-multimodal',
      'sea-delay',
      'customs-hold',
      'stale-no-eta',
    ])
    for (const { offsetMinutes, event } of scenarios.flatMap((item) => item.scheduledEvents)) {
      const release = Date.parse(dataset.referenceTime) + offsetMinutes * 60_000
      expect(offsetMinutes).toBeGreaterThan(0)
      expect(Date.parse(event.receivedAt)).toBe(release)
      expect(Date.parse(event.occurredAt)).toBeLessThanOrEqual(release)
    }
    const { steps } = walk()
    expect(steps).toEqual([...steps].sort())
    expect(new Set(steps).size).toBe(steps.length)
  })

  it('recorre los escenarios hasta entregar todos sus envíos', () => {
    const end = walk()
    const views = selectVisibleShipments({
      dataset: end.dataset,
      identityId: 'operations-network',
      cutoffAt: end.cutoffAt,
      selectedShipmentId: null,
    }).filter((view) => scenarioIds.includes(view.shipment.id))
    expect(views).toHaveLength(5)
    expect(views.every((view) => view.projection.lifecycle === 'delivered')).toBe(true)
    // Only the repeated customs hold of the initial feed shares an ID; the resent delivery is not added again.
    const ids = end.dataset.events.map((event) => event.id)
    expect(new Set(ids).size).toBe(ids.length - 1)
    expect(applyScheduledEvents(end.dataset, scenarios, end.cutoffAt)).toBe(end.dataset)
    expect(nextScheduledAt(end.dataset, scenarios, end.cutoffAt)).toBeNull()
  })

  it('reiniciar desde la semilla reproduce el mismo recorrido', () => {
    expect(walk(buildDemoSeed())).toEqual(walk())
    expect(nextScheduledAt(dataset, scenarios, dataset.referenceTime)).toBe(walk().steps[0])
  })
})
