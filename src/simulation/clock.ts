import type { DemoDataset, DemoScenario, IsoDateTime } from '@/domain/contracts'

const releaseAt = (dataset: DemoDataset, offsetMinutes: number) =>
  Date.parse(dataset.referenceTime) + offsetMinutes * 60_000

/** Incorporate every scheduled event released up to the cutoff. Idempotent by event ID. */
export function applyScheduledEvents(
  dataset: DemoDataset,
  scenarios: readonly DemoScenario[],
  cutoffAt: IsoDateTime,
): DemoDataset {
  const existingIds = new Set(dataset.events.map((event) => event.id))
  const events = scenarios
    .flatMap((scenario) => scenario.scheduledEvents)
    .filter((item) => releaseAt(dataset, item.offsetMinutes) <= Date.parse(cutoffAt))
    .map((item) => item.event)
    .filter((event) => !existingIds.has(event.id) && existingIds.add(event.id))
  return events.length
    ? { ...dataset, revision: dataset.revision + 1, events: [...dataset.events, ...events] }
    : dataset
}

/** Release time of the next scheduled event after the cutoff, or null when none remain. */
export function nextScheduledAt(
  dataset: DemoDataset,
  scenarios: readonly DemoScenario[],
  cutoffAt: IsoDateTime,
): IsoDateTime | null {
  const next = scenarios
    .flatMap((scenario) => scenario.scheduledEvents)
    .map((item) => releaseAt(dataset, item.offsetMinutes))
    .filter((time) => time > Date.parse(cutoffAt))
    .sort((a, b) => a - b)[0]
  return next === undefined ? null : new Date(next).toISOString()
}
