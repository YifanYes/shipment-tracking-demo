import type { DemoDataset, DemoSeed } from '@/domain/contracts'
import { active } from './active'
import type { DataPart } from './builders'
import { customsHold, customsHoldScenario } from './customs-hold'
import { buildHistory } from './history'
import { multimodal, multimodalScenario } from './multimodal'
import { nationalDataset, nationalScenario } from './national'
import { accounts, identities, locations, operators, referenceTime } from './network'
import { seaDelay, seaDelayScenario } from './sea-delay'
import { staleNoEta, staleNoEtaScenario } from './stale-no-eta'

/** Phase 1 seed: a single national shipment. Kept for regression tests. */
export const nationalSeed: DemoSeed = { dataset: nationalDataset, scenarios: [nationalScenario] }

/** Builds the full demo dataset. Pure and deterministic: two builds are deep-equal. */
export function buildDemoSeed(): DemoSeed {
  const national: DataPart = {
    shipments: [...nationalDataset.shipments],
    events: [...nationalDataset.events],
    documents: [],
  }
  const parts = [national, multimodal, seaDelay, customsHold, staleNoEta, active, buildHistory()]
  const dataset: DemoDataset = {
    revision: 1,
    referenceTime,
    accounts,
    identities,
    locations,
    operators,
    shipments: parts.flatMap((part) => part.shipments),
    events: parts.flatMap((part) => part.events),
    documents: parts.flatMap((part) => part.documents),
  }
  return {
    dataset,
    scenarios: [
      nationalScenario,
      multimodalScenario,
      seaDelayScenario,
      customsHoldScenario,
      staleNoEtaScenario,
    ],
  }
}

/** Full demo seed: active scenarios, other active shipments and 90 days of history. */
export const demoSeed: DemoSeed = buildDemoSeed()
