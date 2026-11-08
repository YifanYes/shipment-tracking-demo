import type { DemoScenario } from '@/domain/contracts'
import {
  at,
  document,
  eventsFor,
  hours,
  makeShipment,
  scheduled,
  withDocuments,
  type DataPart,
} from './builders'

/** Barcelona → Génova by sea; the carrier announces a new ETA after a storm. */
const base = makeShipment({
  id: 'shipment-it-003',
  reference: 'ATL-IT-003',
  accountId: 'account-atlantico',
  lane: {
    originSiteId: 'site-barcelona',
    destinationLocationId: 'destination-milano',
    originPortId: 'port-barcelona',
    roadOperatorId: 'operator-cierzo',
  },
  createdAt: at(-hours(60)),
  committedDeliveryAt: at(hours(36)),
})
const documents = [
  document(base, 'packing_list', 'Lista de bultos ATL-IT-003', at(-hours(60))),
  document(base, 'bill_of_lading', 'Conocimiento de embarque BOR-IT-003', at(-hours(15))),
]
const shipment = withDocuments(base, documents)
const event = eventsFor(shipment)

export const seaDelay: DataPart = {
  shipments: [shipment],
  documents,
  events: [
    event(1, 'REC', -hours(56), {
      message: 'RECOGIDA EFECTUADA PLANTA MARTORELL',
      locationId: 'site-barcelona',
    }),
    event(1, 'TRA', -hours(55.5), { message: 'EN TRANSITO A PUERTO BCN' }),
    event(1, 'ENT', -hours(54.5), {
      message: 'ENTREGADO TERMINAL PUERTO BARCELONA',
      locationId: 'port-barcelona',
    }),
    event(2, 'GATE_IN', -hours(54), {
      message: 'Container gated in at Barcelona terminal.',
      locationId: 'port-barcelona',
    }),
    // Reported late: received after the departure, it must not move the shipment backwards.
    event(2, 'LOADED_ON_VESSEL', -hours(20), {
      message: 'Container loaded on board.',
      locationId: 'port-barcelona',
      receivedAfter: hours(16),
    }),
    event(2, 'VESSEL_DEPARTED', -hours(16), {
      message: 'Vessel departed Barcelona.',
      payload: { eta: at(hours(26)) },
      locationId: 'port-barcelona',
    }),
    event(2, 'NOON_REPORT', -hours(2), {
      message: 'Noon report: Gulf of Lion.',
      locationId: 'waypoint-sea-golfo-leon',
    }),
  ],
}

export const seaDelayScenario: DemoScenario = {
  id: 'sea-delay',
  name: 'Retraso marítimo con nueva ETA',
  shipmentIds: [shipment.id],
  scheduledEvents: [
    // The ETA still holds, but the message anticipates what the operator confirms an hour later.
    scheduled(
      30,
      event(2, 'NOON_REPORT', 25, {
        message: 'Position report: Gulf of Lion, reduced speed due to weather.',
        locationId: 'waypoint-sea-golfo-leon',
        key: 'noon-report-weather',
      }),
    ),
    scheduled(
      90,
      event(2, 'DELAY_NOTICE', 85, {
        message: 'Delay notice: heavy weather in the Gulf of Lion. Revised ETA communicated.',
        payload: { eta: at(hours(44)) },
      }),
    ),
    scheduled(
      hours(22),
      event(2, 'NOON_REPORT', hours(22), {
        message: 'Noon report: Ligurian Sea.',
        locationId: 'waypoint-sea-liguria',
        key: 'noon-report-2',
      }),
    ),
    scheduled(
      hours(37),
      event(2, 'VESSEL_ARRIVED', hours(36), {
        message: 'Vessel arrived at Genoa.',
        locationId: 'port-genova',
      }),
    ),
    scheduled(
      hours(37),
      event(2, 'DISCHARGED', hours(37), {
        message: 'Container discharged at Genoa.',
        locationId: 'port-genova',
      }),
    ),
    scheduled(
      hours(38.5),
      event(3, 'REC', hours(38.5), {
        message: 'RECOGIDA EFECTUADA PUERTO GENOVA',
        locationId: 'port-genova',
      }),
    ),
    scheduled(
      hours(39),
      event(3, 'TRA', hours(39), {
        message: 'EN TRANSITO A MILAN',
        payload: { llegadaPrevista: at(hours(42.5)) },
      }),
    ),
    scheduled(
      hours(42.25),
      event(3, 'ENT', hours(42.25), {
        message: 'ENTREGADO DISTRIBUIDOR MILAN',
        locationId: 'destination-milano',
      }),
    ),
  ],
}
