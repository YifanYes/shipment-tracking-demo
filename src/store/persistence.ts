import type { ActivityRecord, DemoDataset, DemoSeed, IsoDateTime } from '@/domain/contracts'
import { applyActivity } from '@/domain/actions'
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

const actionKinds = new Set<ActivityRecord['action']>([
  'notify_customer',
  'contact_operator',
  'provide_document',
])
const isString = (value: unknown): value is string => typeof value === 'string'

function validRecord(value: unknown, dataset: DemoDataset, cutoff: number) {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    ['id', 'actionId', 'shipmentId', 'incidentId', 'actorIdentityId', 'recordedAt'].every((key) =>
      isString(record[key]),
    ) &&
    ['recipient', 'subject', 'message'].every((key) => isString(record[key])) &&
    actionKinds.has(record.action as ActivityRecord['action']) &&
    Date.parse(record.recordedAt as string) <= cutoff &&
    dataset.shipments.some((shipment) => shipment.id === record.shipmentId) &&
    dataset.identities.some((identity) => identity.id === record.actorIdentityId) &&
    (record.documentId === undefined ||
      dataset.documents.some(
        (document) =>
          document.id === record.documentId && document.shipmentId === record.shipmentId,
      ))
  )
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
    !snapshot.activity.every((record) => validRecord(record, dataset, cutoff)) ||
    typeof snapshot.sidebarCollapsed !== 'boolean'
  )
    return null
  const cutoffAt = new Date(cutoff).toISOString()
  return {
    identityId: snapshot.identityId!,
    cutoffAt,
    dataset: applyActivity(
      applyScheduledEvents(dataset, seed.scenarios, cutoffAt),
      snapshot.activity,
    ),
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
