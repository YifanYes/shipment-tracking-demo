import type { DemoDataset, DemoScenario } from '@/domain/contracts'

export function advanceScenario(dataset: DemoDataset, scenario: DemoScenario) {
  const cutoffAt = new Date(
    Date.parse(dataset.referenceTime) +
      Math.max(0, ...scenario.scheduledEvents.map((item) => item.offsetMinutes)) * 60_000,
  ).toISOString()
  const existingIds = new Set(dataset.events.map((event) => event.id))
  const events = scenario.scheduledEvents
    .map((item) => item.event)
    .filter((event) => !existingIds.has(event.id))
  return {
    cutoffAt,
    dataset: events.length
      ? { ...dataset, revision: dataset.revision + 1, events: [...dataset.events, ...events] }
      : dataset,
  }
}
