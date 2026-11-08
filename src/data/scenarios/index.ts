import type { DemoDataset, DemoSeed, DemoStep } from '@/domain/contracts'
import { active } from './active'
import { buildBackgroundScenario } from './background'
import { clockAt, dateTimeAt, hours, type DataPart } from './builders'
import { customsHold, customsHoldScenario } from './customs-hold'
import { buildHistory } from './history'
import { multimodal, multimodalScenario } from './multimodal'
import { nationalDataset, nationalScenario } from './national'
import { accounts, identities, locations, operators, referenceTime } from './network'
import { seaDelay, seaDelayScenario } from './sea-delay'
import { staleNoEta, staleNoEtaScenario } from './stale-no-eta'

/** Phase 1 seed: a single national shipment. Kept for regression tests. */
export const nationalSeed: DemoSeed = {
  dataset: nationalDataset,
  scenarios: [nationalScenario],
  steps: [{ id: 'national-delivery', label: 'Entrega de ATL-ES-001', offsetMinutes: 120 }],
}

/**
 * Demo moments, in the order of the demo script. Each one releases the story events up to its
 * time together with the routine progress of the rest of the operation.
 */
export const demoSteps: readonly DemoStep[] = [
  {
    id: 'vessel-slowdown',
    label: 'Parte del buque de ATL-IT-003',
    offsetMinutes: 30,
    story: {
      shipmentId: 'shipment-it-003',
      title: 'Posible retraso de ATL-IT-003',
      detail: 'Velocidad reducida por mal tiempo. Estimación: el operador mantiene su ETA.',
    },
  },
  {
    id: 'sea-delay-notice',
    label: 'Retraso marítimo de ATL-IT-003',
    offsetMinutes: 90,
    story: {
      shipmentId: 'shipment-it-003',
      title: 'ATL-IT-003 llegará tarde a Milán',
      detail: `Nueva ETA: ${dateTimeAt(hours(44))}. Comprometida: ${dateTimeAt(hours(36))}.`,
    },
  },
  {
    id: 'operator-reply',
    label: 'Respuesta del operador de ATL-ES-005',
    offsetMinutes: 180,
    story: {
      shipmentId: 'shipment-es-005',
      title: 'ATL-ES-005 vuelve a informar',
      detail: `Sigue en ruta. Entrega prevista a las ${clockAt(hours(7.5))}.`,
    },
  },
  { id: 'afternoon-deliveries', label: 'Entregas de la tarde', offsetMinutes: 480 },
  {
    id: 'customs-release',
    label: 'Liberación aduanera de ATL-TR-004',
    offsetMinutes: 1560,
    story: {
      shipmentId: 'shipment-tr-004',
      title: 'ATL-TR-004 sale de la aduana',
      detail: `Entrega prevista en Adana a las ${clockAt(hours(30))}, con retraso.`,
    },
  },
  { id: 'international-deliveries', label: 'Entregas internacionales', offsetMinutes: 1740 },
  {
    id: 'revised-arrival',
    label: 'Llegada de ATL-IT-003',
    offsetMinutes: 2535,
    story: {
      shipmentId: 'shipment-it-003',
      title: 'ATL-IT-003 entregado en Milán',
      detail: 'Con retraso sobre la fecha comprometida.',
    },
  },
]

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
  const story = [
    nationalScenario,
    multimodalScenario,
    seaDelayScenario,
    customsHoldScenario,
    staleNoEtaScenario,
  ]
  const storyShipmentIds = story.flatMap((scenario) => scenario.shipmentIds)
  return {
    dataset,
    scenarios: [...story, buildBackgroundScenario(dataset, storyShipmentIds, demoSteps)],
    steps: demoSteps,
  }
}

/** Full demo seed: active scenarios, other active shipments and 90 days of history. */
export const demoSeed: DemoSeed = buildDemoSeed()
