import type { ActivityRecord, DemoDataset, DemoSeed, IsoDateTime } from '@/domain/contracts'
import { recordAction } from '@/domain/actions'
import { selectVisibleShipments } from '@/domain/selectors'
import { applyScheduledEvents } from '@/simulation/clock'

export const STORAGE_KEY = 'atlas-demo'
/** Increase when the snapshot or the seed it refers to changes incompatibly. */
export const STORAGE_VERSION = 1

/** What a session needs to resume: the facts are rebuilt from the seed. */
export interface DemoSnapshot {
  version: typeof STORAGE_VERSION
  identityId: string
  cutoffAt: IsoDateTime
  activity: readonly ActivityRecord[]
  sidebarCollapsed: boolean
}

export interface RestoredSession {
  identityId: string
  cutoffAt: IsoDateTime
  dataset: DemoDataset
  sidebarCollapsed: boolean
}

const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * Replay the records in order through the same rule that created them. A record that the
 * identity could not have made at that step, or that differs from what the rule produces,
 * invalidates the whole list. Returns the dataset at the last record's step.
 */
function replayActivity(seed: DemoSeed, records: readonly unknown[], stops: readonly number[]) {
  let dataset = seed.dataset
  let previous = -Infinity
  for (const value of records) {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    const { recordedAt, actorIdentityId, shipmentId, actionId, message } = record
    if (![recordedAt, actorIdentityId, shipmentId, actionId, message].every(isString)) return null
    const at = recordedAt as string
    const time = Date.parse(at)
    if (!stops.includes(time) || time < previous) return null
    previous = time
    const actor = dataset.identities.find((identity) => identity.id === actorIdentityId)
    if (actor?.role !== 'operations') return null
    dataset = applyScheduledEvents(dataset, seed.scenarios, at)
    const view = selectVisibleShipments({
      dataset,
      identityId: actor.id,
      cutoffAt: at,
      selectedShipmentId: null,
    }).find((item) => item.shipment.id === shipmentId)
    if (!view) return null
    const next = recordAction({
      dataset,
      view,
      actionId: actionId as string,
      actorIdentityId: actor.id,
      at,
      message: message as string,
    })
    if (next === dataset || JSON.stringify(next.activity?.at(-1)) !== JSON.stringify(record))
      return null
    dataset = next
  }
  return dataset
}

/**
 * Rebuild a session from storage. Any unknown version, identity, clock position or record
 * discards the whole snapshot: the demo starts again from the seed.
 */
export function restoreSession(seed: DemoSeed, raw: string | null): RestoredSession | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<DemoSnapshot>
  const { dataset, steps } = seed
  const reference = Date.parse(dataset.referenceTime)
  const stops = [dataset.referenceTime, ...steps.map((step) => step.offsetMinutes)].map((item) =>
    typeof item === 'number' ? reference + item * 60_000 : Date.parse(item),
  )
  const cutoff = isString(snapshot.cutoffAt) ? Date.parse(snapshot.cutoffAt) : NaN
  if (
    snapshot.version !== STORAGE_VERSION ||
    !dataset.identities.some((identity) => identity.id === snapshot.identityId) ||
    !stops.includes(cutoff) ||
    !Array.isArray(snapshot.activity) ||
    typeof snapshot.sidebarCollapsed !== 'boolean'
  )
    return null
  const replayed = replayActivity(seed, snapshot.activity, stops)
  if (!replayed || snapshot.activity.some((record) => Date.parse(record.recordedAt) > cutoff))
    return null
  const cutoffAt = new Date(cutoff).toISOString()
  return {
    identityId: snapshot.identityId!,
    cutoffAt,
    dataset: applyScheduledEvents(replayed, seed.scenarios, cutoffAt),
    sidebarCollapsed: snapshot.sidebarCollapsed,
  }
}

export function snapshotOf(state: {
  identityId: string
  cutoffAt: IsoDateTime
  dataset: DemoDataset
  sidebarCollapsed: boolean
}): DemoSnapshot {
  return {
    version: STORAGE_VERSION,
    identityId: state.identityId,
    cutoffAt: state.cutoffAt,
    activity: state.dataset.activity ?? [],
    sidebarCollapsed: state.sidebarCollapsed,
  }
}

/** localStorage when the browser allows it; null in private modes that throw on access. */
export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
