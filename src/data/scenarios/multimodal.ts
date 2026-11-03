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

/** Madrid → Algeciras by road, ferry to Tanger Med, customs and last mile to Casablanca. */
const base = makeShipment({
  id: 'shipment-ma-002',
  reference: 'ATL-MA-002',
  accountId: 'account-levante',
  lane: {
    originSiteId: 'site-madrid',
    destinationLocationId: 'destination-casablanca',
    originPortId: 'port-algeciras',
    roadOperatorId: 'operator-iberia',
  },
  createdAt: at(-hours(8)),
  committedDeliveryAt: at(hours(40)),
})
const documents = [
  document(base, 'packing_list', 'Lista de bultos ATL-MA-002', at(-hours(8))),
  document(base, 'customs', 'Certificado de circulación EUR.1', at(-hours(6))),
]
const shipment = withDocuments(base, documents)
const event = eventsFor(shipment)

const roadDelivered = event(1, 'DELIVERED', 150, {
  message: 'Entrega confirmada en la terminal del puerto de Algeciras.',
  locationId: 'port-algeciras',
})

export const multimodal: DataPart = {
  shipments: [shipment],
  documents,
  events: [
    event(1, 'PICKED_UP', -300, {
      message: 'Mercancía recogida en el centro de Madrid.',
      locationId: 'site-madrid',
    }),
    event(1, 'ON_ROUTE', -30, {
      message: 'En ruta por la A-4 a la altura de Bailén.',
      locationId: 'waypoint-a4-bailen',
    }),
  ],
}

export const multimodalScenario: DemoScenario = {
  id: 'international-multimodal',
  name: 'Envío multimodal con aduana',
  shipmentIds: [shipment.id],
  scheduledEvents: [
    scheduled(150, roadDelivered),
    scheduled(
      180,
      event(2, 'GATE_IN', 175, {
        message: 'Trailer gated in at Algeciras ferry terminal.',
        locationId: 'port-algeciras',
      }),
    ),
    // The road operator resends its delivery; the same ID has no further effect.
    scheduled(180, roadDelivered),
    scheduled(
      480,
      event(2, 'LOADED_ON_VESSEL', 470, {
        message: 'Trailer loaded on board.',
        locationId: 'port-algeciras',
      }),
    ),
    scheduled(
      480,
      event(2, 'VESSEL_DEPARTED', 480, {
        message: 'Vessel departed Algeciras.',
        locationId: 'port-algeciras',
      }),
    ),
    scheduled(
      600,
      event(2, 'VESSEL_ARRIVED', 590, {
        message: 'Vessel arrived at Tanger Med.',
        locationId: 'port-tanger-med',
      }),
    ),
    scheduled(
      600,
      event(2, 'DISCHARGED', 600, {
        message: 'Trailer discharged at Tanger Med.',
        locationId: 'port-tanger-med',
      }),
    ),
    scheduled(
      840,
      event(3, 'ENTRY_LODGED', 840, {
        message: 'Declaración de importación presentada en Tanger Med.',
        locationId: 'port-tanger-med',
      }),
    ),
    scheduled(
      1260,
      event(3, 'CUSTOMS_RELEASED', 1255, {
        message: 'Despacho concluido. Mercancía liberada para el transporte.',
        payload: { deliveryEta: at(hours(28)) },
        locationId: 'port-tanger-med',
      }),
    ),
    scheduled(
      1320,
      event(3, 'TRUCK_DEPARTED', 1320, {
        message: 'Camión en ruta hacia Casablanca.',
        locationId: 'port-tanger-med',
      }),
    ),
    scheduled(
      1440,
      event(3, 'CHECKPOINT', 1440, {
        message: 'Paso por la A1 a la altura de Larache.',
        locationId: 'waypoint-a1-larache',
      }),
    ),
    scheduled(
      1620,
      event(3, 'POD', 1615, {
        message: 'Entrega firmada en el distribuidor de Casablanca.',
        locationId: 'destination-casablanca',
      }),
    ),
  ],
}
