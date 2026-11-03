import type { LegStage, ShipmentView } from '@/domain/contracts'
import { attentionReasons } from '@/domain/attention'
import { stageLabels } from '@/shared/lib/format'
import { deliveredAt, expectedArrival, modeLabels } from './presentation'

export type ModeKey = 'road' | 'sea' | 'multimodal'
export type ProgressKey = 'open' | 'planned' | 'active' | 'delivered' | `stage:${LegStage}`
export type RiskKey = 'attention' | 'clear'

/** Empty strings mean "no restriction". */
export interface ShipmentFilters {
  query: string
  originSiteId: string
  accountId: string
  operatorId: string
  mode: ModeKey | ''
  progress: ProgressKey | ''
  risk: RiskKey | ''
}

export const emptyShipmentFilters: ShipmentFilters = {
  query: '',
  originSiteId: '',
  accountId: '',
  operatorId: '',
  mode: '',
  progress: '',
  risk: '',
}

export interface FilterOption<T extends string = string> {
  value: T
  label: string
}

export interface ShipmentFilterOptions {
  origins: FilterOption[]
  accounts: FilterOption[]
  operators: FilterOption[]
  modes: FilterOption<ModeKey>[]
  stages: FilterOption<ProgressKey>[]
}

export function modeKey(view: ShipmentView): ModeKey {
  const modes = new Set(view.shipment.legs.map((leg) => leg.mode))
  return modes.size > 1 ? 'multimodal' : modes.has('sea') ? 'sea' : 'road'
}

export function hasActiveFilters(filters: ShipmentFilters) {
  return Object.values(filters).some((value) => value.trim() !== '')
}

/** Lower case without diacritics, so "cadiz" finds "Cádiz". */
export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function searchableText(view: ShipmentView) {
  return normalizeText(
    [
      view.shipment.reference,
      view.account?.name,
      view.origin?.name,
      view.origin?.placeLabel,
      view.destination?.name,
      view.destination?.placeLabel,
      ...view.locations.flatMap((location) => [location.name, location.placeLabel]),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function byLabel<T extends string>(options: Map<T, string>): FilterOption<T>[] {
  return [...options]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

/** Options come only from the views the identity can see. */
export function shipmentFilterOptions(views: readonly ShipmentView[]): ShipmentFilterOptions {
  const origins = new Map<string, string>()
  const accounts = new Map<string, string>()
  const operators = new Map<string, string>()
  const modes = new Map<ModeKey, string>()
  const stages = new Set<LegStage>()
  for (const view of views) {
    if (view.origin) origins.set(view.origin.id, view.origin.name)
    if (view.account) accounts.set(view.account.id, view.account.name)
    for (const operator of view.operators) operators.set(operator.id, operator.name)
    const key = modeKey(view)
    modes.set(key, key === 'multimodal' ? 'Combinado' : modeLabels[key])
    if (view.projection.lifecycle === 'active' && view.projection.currentStage)
      stages.add(view.projection.currentStage)
  }
  const stageOrder = Object.keys(stageLabels) as LegStage[]
  return {
    origins: byLabel(origins),
    accounts: byLabel(accounts),
    operators: byLabel(operators),
    modes: byLabel(modes),
    stages: stageOrder
      .filter((stage) => stages.has(stage))
      .map((stage) => ({ value: `stage:${stage}` as const, label: stageLabels[stage] })),
  }
}

function matchesProgress(view: ShipmentView, progress: ProgressKey) {
  const { lifecycle, currentStage } = view.projection
  if (progress === 'open') return lifecycle !== 'delivered'
  if (progress.startsWith('stage:'))
    return lifecycle === 'active' && `stage:${currentStage}` === progress
  return lifecycle === progress
}

export function filterShipments(
  views: readonly ShipmentView[],
  filters: ShipmentFilters,
  cutoffAt: string,
): ShipmentView[] {
  const terms = normalizeText(filters.query).split(/\s+/).filter(Boolean)
  return views.filter((view) => {
    if (terms.length) {
      const text = searchableText(view)
      if (!terms.every((term) => text.includes(term))) return false
    }
    if (filters.originSiteId && view.shipment.originSiteId !== filters.originSiteId) return false
    if (filters.accountId && view.shipment.accountId !== filters.accountId) return false
    if (
      filters.operatorId &&
      !view.shipment.legs.some((leg) => leg.operatorId === filters.operatorId)
    )
      return false
    if (filters.mode && modeKey(view) !== filters.mode) return false
    if (filters.progress && !matchesProgress(view, filters.progress)) return false
    if (filters.risk) {
      const attention = attentionReasons(view, cutoffAt).length > 0
      if (attention !== (filters.risk === 'attention')) return false
    }
    return true
  })
}

const lifecycleRank = { active: 0, planned: 1, delivered: 2 } as const

/**
 * Work queue order: shipments needing attention, then open ones by expected arrival or
 * commitment, then deliveries from most recent.
 */
export function sortShipments(views: readonly ShipmentView[], cutoffAt: string): ShipmentView[] {
  const attention = new Map(
    views.map((view) => [view.shipment.id, attentionReasons(view, cutoffAt).length > 0]),
  )
  const openTime = (view: ShipmentView) =>
    Date.parse(expectedArrival(view.projection.eta) ?? view.shipment.committedDeliveryAt)
  const deliveredTime = (view: ShipmentView) =>
    Date.parse(deliveredAt(view) ?? view.shipment.committedDeliveryAt)
  return [...views].sort((a, b) => {
    const aDelivered = a.projection.lifecycle === 'delivered'
    const bDelivered = b.projection.lifecycle === 'delivered'
    if (aDelivered !== bDelivered) return Number(aDelivered) - Number(bDelivered)
    if (aDelivered) return deliveredTime(b) - deliveredTime(a) || compareReference(a, b)
    return (
      Number(attention.get(b.shipment.id)) - Number(attention.get(a.shipment.id)) ||
      lifecycleRank[a.projection.lifecycle] - lifecycleRank[b.projection.lifecycle] ||
      openTime(a) - openTime(b) ||
      compareReference(a, b)
    )
  })
}

function compareReference(a: ShipmentView, b: ShipmentView) {
  return a.shipment.reference.localeCompare(b.shipment.reference)
}
