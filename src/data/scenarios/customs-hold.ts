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

/**
 * Madrid → Valencia → Mersin, held at customs for a missing A.TR certificate. Providing the
 * document resolves the documentary task only; the release is a later operator event.
 */
const base = makeShipment({
  id: 'shipment-tr-004',
  reference: 'ATL-TR-004',
  accountId: 'account-levante',
  lane: {
    originSiteId: 'site-madrid',
    destinationLocationId: 'destination-adana',
    originPortId: 'port-valencia',
    roadOperatorId: 'operator-iberia',
  },
  createdAt: at(-hours(264)),
  committedDeliveryAt: at(hours(24)),
})
const documents = [
  document(base, 'packing_list', 'Lista de bultos ATL-TR-004', at(-hours(264))),
  document(base, 'bill_of_lading', 'Conocimiento de embarque BOR-TR-004', at(-hours(186))),
  document(base, 'customs', 'Certificado de circulación A.TR'),
]
const shipment = withDocuments(base, documents)
const event = eventsFor(shipment)
const missingCertificate = documents[2]!.id

const hold = event(3, 'CUSTOMS_HOLD', -hours(20), {
  message: 'Retención aduanera en Mersin: falta el certificado A.TR.',
  locationId: 'port-mersin',
})

export const customsHold: DataPart = {
  shipments: [shipment],
  documents,
  events: [
    event(1, 'PICKED_UP', -hours(258), {
      message: 'Mercancía recogida en el centro de Madrid.',
      locationId: 'site-madrid',
    }),
    event(1, 'ON_ROUTE', -hours(256), { message: 'En ruta por la A-3 hacia el puerto.' }),
    event(1, 'DELIVERED', -hours(253), {
      message: 'Entrega confirmada en la terminal del puerto de Valencia.',
      locationId: 'port-valencia',
    }),
    event(2, 'GATE_IN', -hours(252.5), {
      message: 'Container gated in at Valencia terminal.',
      locationId: 'port-valencia',
    }),
    event(2, 'LOADED_ON_VESSEL', -hours(190), {
      message: 'Container loaded on board.',
      locationId: 'port-valencia',
    }),
    event(2, 'VESSEL_DEPARTED', -hours(186), {
      message: 'Vessel departed Valencia.',
      payload: { eta: at(hours(14)) },
      locationId: 'port-valencia',
    }),
    event(2, 'NOON_REPORT', -hours(140), {
      message: 'Noon report: Strait of Sicily.',
      locationId: 'waypoint-sea-canal-sicilia',
    }),
    event(2, 'VESSEL_ARRIVED', -hours(70), {
      message: 'Vessel arrived at Mersin.',
      locationId: 'port-mersin',
    }),
    event(2, 'DISCHARGED', -hours(64), {
      message: 'Container discharged at Mersin.',
      locationId: 'port-mersin',
    }),
    event(3, 'ENTRY_LODGED', -hours(60), {
      message: 'Declaración de importación presentada en Mersin.',
      locationId: 'port-mersin',
    }),
    hold,
    // The agent's feed repeats the hold with the same ID.
    hold,
    event(3, 'DOC_REQUIRED', -hours(19.9), {
      message: 'La aduana requiere el certificado de circulación A.TR.',
      payload: { documentId: missingCertificate },
    }),
  ],
}

export const customsHoldScenario: DemoScenario = {
  id: 'customs-hold',
  name: 'Retención aduanera por documentación',
  shipmentIds: [shipment.id],
  scheduledEvents: [
    scheduled(
      hours(26),
      event(3, 'CUSTOMS_RELEASED', hours(26) - 5, {
        message: 'Retención levantada con garantía. Mercancía liberada para el transporte.',
        payload: { deliveryEta: at(hours(30)) },
        locationId: 'port-mersin',
      }),
    ),
    scheduled(
      hours(27.5),
      event(3, 'TRUCK_DEPARTED', hours(27.5), {
        message: 'Camión en ruta hacia Adana.',
        locationId: 'port-mersin',
      }),
    ),
    scheduled(
      hours(29),
      event(3, 'POD', hours(29), {
        message: 'Entrega firmada en el distribuidor de Adana.',
        locationId: 'destination-adana',
      }),
    ),
  ],
}
