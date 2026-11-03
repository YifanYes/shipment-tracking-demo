import { describe, expect, it } from 'vitest'
import type { DemoDataset, DemoSeed } from '@/domain/contracts'
import { buildDemoSeed, demoSeed } from '@/data/scenarios'
import { attentionReasons } from '@/domain/attention'
import { selectVisibleShipments } from '@/domain/selectors'
import { applyScheduledEvents, nextDemoStep } from '@/simulation/clock'

const { dataset, scenarios } = demoSeed
const story = scenarios.filter((scenario) => scenario.id !== 'background-operations')
const storyIds = story.flatMap((scenario) => scenario.shipmentIds)
const views = (current: DemoDataset, cutoffAt: string) =>
  selectVisibleShipments({
    dataset: current,
    identityId: 'operations-network',
    cutoffAt,
    selectedShipmentId: null,
  })

function walk(seed: DemoSeed = demoSeed) {
  let current = seed.dataset
  let cutoffAt = seed.dataset.referenceTime
  const steps: { label: string; at: string; attention: string[]; stale: string[] }[] = []
  for (let step = nextDemoStep(current, seed.steps, cutoffAt); step;) {
    current = applyScheduledEvents(current, seed.scenarios, step.at)
    cutoffAt = step.at
    const visible = views(current, cutoffAt)
    steps.push({
      label: step.label,
      at: step.at,
      attention: visible
        .filter((view) => attentionReasons(view, cutoffAt).length)
        .map((view) => view.shipment.reference),
      stale: visible
        .filter(
          (view) => view.projection.freshness === 'stale' && !storyIds.includes(view.shipment.id),
        )
        .map((view) => view.shipment.reference),
    })
    step = nextDemoStep(current, seed.steps, cutoffAt)
  }
  return { dataset: current, cutoffAt, steps }
}

describe('pasos de la demo', () => {
  it('libera los eventos programados al recibirse, antes de su paso y en orden', () => {
    const lastStep = Math.max(...demoSeed.steps.map((step) => step.offsetMinutes))
    for (const { offsetMinutes, event } of scenarios.flatMap((item) => item.scheduledEvents)) {
      const release = Date.parse(dataset.referenceTime) + offsetMinutes * 60_000
      expect(offsetMinutes).toBeGreaterThan(0)
      expect(offsetMinutes).toBeLessThanOrEqual(lastStep)
      expect(Date.parse(event.receivedAt)).toBe(release)
      expect(Date.parse(event.occurredAt)).toBeLessThanOrEqual(release)
    }
    const { steps } = walk()
    expect(steps.map((step) => step.label)).toEqual(demoSeed.steps.map((step) => step.label))
    expect(steps.map((step) => step.at)).toEqual(steps.map((step) => step.at).sort())
  })

  it('mantiene al día el resto de la operación en cada paso', () => {
    for (const step of walk().steps) expect(step.stale, step.label).toEqual([])
  })

  it('termina con los escenarios entregados y solo la documentación pendiente', () => {
    const end = walk()
    const finalViews = views(end.dataset, end.cutoffAt)
    expect(
      finalViews
        .filter((view) => storyIds.includes(view.shipment.id))
        .every((view) => view.projection.lifecycle === 'delivered'),
    ).toBe(true)
    expect(end.steps.at(-1)!.attention).toEqual(['ATL-TR-004'])
    const pending = finalViews.find((view) => view.shipment.reference === 'ATL-TR-004')!
    expect(
      pending.incidents.filter((incident) => incident.condition === 'active').map((i) => i.kind),
    ).toEqual(['missing_document'])
    expect(applyScheduledEvents(end.dataset, scenarios, end.cutoffAt)).toBe(end.dataset)
    expect(nextDemoStep(end.dataset, demoSeed.steps, end.cutoffAt)).toBeNull()
  })

  it('reiniciar desde la semilla reproduce el mismo recorrido', () => {
    expect(walk(buildDemoSeed())).toEqual(walk())
  })
})
