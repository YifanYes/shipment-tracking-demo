import type { OperatorEvent, Shipment, ShipmentDocument } from '@/domain/contracts'
import {
  at,
  document,
  eventsFor,
  hours,
  makeShipment,
  withDocuments,
  type DataPart,
  type LanePlan,
} from './builders'

type EventBuilder = ReturnType<typeof eventsFor>

interface ActiveSpec {
  id: string
  accountId: string
  lane: LanePlan
  createdHoursAgo: number
  committedInHours: number
  documents?: (shipment: Shipment) => ShipmentDocument[]
  events: (event: EventBuilder) => OperatorEvent[]
}

const h = (value: number) => hours(value)

/** Active shipments at the reference time, besides the five scenarios. */
const specs: ActiveSpec[] = [
  {
    id: 'shipment-es-006',
    accountId: 'account-norte',
    lane: {
      originSiteId: 'site-madrid',
      destinationLocationId: 'destination-sevilla',
      roadOperatorId: 'operator-iberia',
    },
    createdHoursAgo: 6,
    committedInHours: 6,
    documents: (s) => [document(s, 'delivery_note', 'Albarán ATL-ES-006', at(-h(6)))],
    events: (event) => [
      event(1, 'PICKED_UP', -h(4), {
        message: 'Mercancía recogida en el centro de Madrid.',
        locationId: 'site-madrid',
      }),
      event(1, 'ON_ROUTE', -h(1), {
        message: 'En ruta por la A-5 a la altura de Trujillo.',
        payload: { arrivalAt: at(h(2.5)) },
        locationId: 'waypoint-a5-trujillo',
      }),
    ],
  },
  {
    id: 'shipment-es-007',
    accountId: 'account-levante',
    lane: {
      originSiteId: 'site-madrid',
      destinationLocationId: 'destination-bilbao',
      roadOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 3,
    committedInHours: 10,
    events: (event) => [
      event(1, 'REC', -h(0.5), {
        message: 'RECOGIDA EFECTUADA CENTRO MADRID',
        locationId: 'site-madrid',
      }),
    ],
  },
  {
    id: 'shipment-es-008',
    accountId: 'account-atlantico',
    lane: {
      originSiteId: 'site-barcelona',
      destinationLocationId: 'destination-valencia',
      roadOperatorId: 'operator-iberia',
    },
    createdHoursAgo: 8,
    committedInHours: 2,
    documents: (s) => [document(s, 'delivery_note', 'Albarán ATL-ES-008', at(-h(8)))],
    events: (event) => [
      event(1, 'PICKED_UP', -h(5.5), {
        message: 'Mercancía recogida en la planta de Martorell.',
        locationId: 'site-barcelona',
      }),
      event(1, 'ON_ROUTE', -h(3), {
        message: 'En ruta por la AP-7 a la altura de Castellón.',
        payload: { arrivalAt: at(h(0.5)) },
        locationId: 'waypoint-ap7-castellon',
      }),
      event(1, 'OUT_FOR_DELIVERY', -h(0.5), { message: 'En reparto en Valencia.' }),
    ],
  },
  {
    id: 'shipment-es-009',
    accountId: 'account-norte',
    lane: {
      originSiteId: 'site-barcelona',
      destinationLocationId: 'destination-murcia',
      roadOperatorId: 'operator-iberia',
    },
    createdHoursAgo: 10,
    committedInHours: 6,
    events: (event) => [
      event(1, 'PICKED_UP', -h(6), {
        message: 'Mercancía recogida en la planta de Martorell.',
        locationId: 'site-barcelona',
      }),
      event(1, 'ON_ROUTE', -h(3.5), {
        message: 'En ruta por la AP-7 a la altura de Benicarló.',
        payload: { arrivalAt: at(h(3)) },
        locationId: 'waypoint-ap7-benicarlo',
      }),
    ],
  },
  {
    id: 'shipment-es-010',
    accountId: 'account-levante',
    lane: {
      originSiteId: 'site-zaragoza',
      destinationLocationId: 'destination-bilbao',
      roadOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 30,
    committedInHours: 4,
    events: (event) => [
      event(1, 'REC', -h(3), {
        message: 'RECOGIDA EFECTUADA PLATAFORMA ZARAGOZA',
        locationId: 'site-zaragoza',
      }),
      event(1, 'TRA', -h(1), {
        message: 'EN TRANSITO AP-68 LOGROÑO',
        payload: { llegadaPrevista: at(h(1.5)) },
        locationId: 'waypoint-ap68-logrono',
      }),
    ],
  },
  {
    // Pickup still pending at the Zaragoza platform: no operator data yet.
    id: 'shipment-es-011',
    accountId: 'account-norte',
    lane: {
      originSiteId: 'site-zaragoza',
      destinationLocationId: 'destination-valencia',
      roadOperatorId: 'operator-iberia',
    },
    createdHoursAgo: 20,
    committedInHours: 10,
    events: () => [],
  },
  {
    id: 'shipment-es-012',
    accountId: 'account-atlantico',
    lane: {
      originSiteId: 'site-zaragoza',
      destinationLocationId: 'destination-malaga',
      roadOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 36,
    committedInHours: 4,
    events: (event) => [
      event(1, 'REC', -h(8), {
        message: 'RECOGIDA EFECTUADA PLATAFORMA ZARAGOZA',
        locationId: 'site-zaragoza',
      }),
      event(1, 'TRA', -h(1.5), {
        message: 'EN TRANSITO A-4 BAILEN',
        payload: { llegadaPrevista: at(h(6)) },
        locationId: 'waypoint-a4-bailen',
      }),
    ],
  },
  {
    id: 'shipment-tr-013',
    accountId: 'account-norte',
    lane: {
      originSiteId: 'site-madrid',
      destinationLocationId: 'destination-adana',
      originPortId: 'port-valencia',
      roadOperatorId: 'operator-iberia',
    },
    createdHoursAgo: 80,
    committedInHours: 24 * 9,
    documents: (s) => [
      document(s, 'packing_list', 'Lista de bultos ATL-TR-013', at(-h(80))),
      document(s, 'customs', 'Certificado de circulación A.TR', at(-h(78))),
    ],
    events: (event) => [
      event(1, 'PICKED_UP', -h(76), {
        message: 'Mercancía recogida en el centro de Madrid.',
        locationId: 'site-madrid',
      }),
      event(1, 'ON_ROUTE', -h(75), { message: 'En ruta por la A-3 hacia el puerto.' }),
      event(1, 'DELIVERED', -h(71.5), {
        message: 'Entrega confirmada en la terminal del puerto de Valencia.',
        locationId: 'port-valencia',
      }),
      event(2, 'GATE_IN', -h(71), {
        message: 'Container gated in at Valencia terminal.',
        locationId: 'port-valencia',
      }),
      event(2, 'VGM_PENDING', -h(30), { message: 'VGM pending carrier review.' }),
      event(2, 'ETA_REVISED', -h(10), {
        message: 'Booking rolled to next sailing. Revised ETA.',
        payload: { eta: at(h(24 * 8)) },
      }),
    ],
  },
  {
    id: 'shipment-gb-014',
    accountId: 'account-levante',
    lane: {
      originSiteId: 'site-madrid',
      destinationLocationId: 'destination-birmingham',
      originPortId: 'port-valencia',
      roadOperatorId: 'operator-iberia',
    },
    createdHoursAgo: 120,
    committedInHours: 24 * 5,
    documents: (s) => [
      document(s, 'packing_list', 'Lista de bultos ATL-GB-014', at(-h(120))),
      document(s, 'bill_of_lading', 'Conocimiento de embarque BOR-GB-014', at(-h(42))),
      document(s, 'customs', 'Declaración de exportación EX-GB-014', at(-h(110))),
    ],
    events: (event) => [
      event(1, 'PICKED_UP', -h(115), {
        message: 'Mercancía recogida en el centro de Madrid.',
        locationId: 'site-madrid',
      }),
      event(1, 'ON_ROUTE', -h(113), { message: 'En ruta por la A-3 hacia el puerto.' }),
      event(1, 'DELIVERED', -h(110.5), {
        message: 'Entrega confirmada en la terminal del puerto de Valencia.',
        locationId: 'port-valencia',
      }),
      event(2, 'GATE_IN', -h(110), {
        message: 'Container gated in at Valencia terminal.',
        locationId: 'port-valencia',
      }),
      event(2, 'LOADED_ON_VESSEL', -h(46), {
        message: 'Container loaded on board.',
        locationId: 'port-valencia',
      }),
      event(2, 'VESSEL_DEPARTED', -h(42), {
        message: 'Vessel departed Valencia.',
        payload: { eta: at(h(24 * 4)) },
        locationId: 'port-valencia',
      }),
      event(2, 'NOON_REPORT', -h(6), {
        message: 'Noon report: off Cape St. Vincent.',
        locationId: 'waypoint-sea-cabo-san-vicente',
      }),
    ],
  },
  {
    id: 'shipment-gb-015',
    accountId: 'account-atlantico',
    lane: {
      originSiteId: 'site-barcelona',
      destinationLocationId: 'destination-birmingham',
      originPortId: 'port-barcelona',
      roadOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 240,
    committedInHours: 30,
    documents: (s) => [
      document(s, 'packing_list', 'Lista de bultos ATL-GB-015', at(-h(240))),
      document(s, 'customs', 'Declaración de importación IM-GB-015', at(-h(31))),
    ],
    events: (event) => [
      event(1, 'REC', -h(236), {
        message: 'RECOGIDA EFECTUADA PLANTA MARTORELL',
        locationId: 'site-barcelona',
      }),
      event(1, 'TRA', -h(235.5), { message: 'EN TRANSITO A PUERTO BCN' }),
      event(1, 'ENT', -h(235), {
        message: 'ENTREGADO TERMINAL PUERTO BARCELONA',
        locationId: 'port-barcelona',
      }),
      event(2, 'GATE_IN', -h(234.5), {
        message: 'Container gated in at Barcelona terminal.',
        locationId: 'port-barcelona',
      }),
      event(2, 'LOADED_ON_VESSEL', -h(212), {
        message: 'Container loaded on board.',
        locationId: 'port-barcelona',
      }),
      event(2, 'VESSEL_DEPARTED', -h(208), {
        message: 'Vessel departed Barcelona.',
        payload: { eta: at(h(10)) },
        locationId: 'port-barcelona',
      }),
      event(2, 'VESSEL_ARRIVED', -h(48), {
        message: 'Vessel arrived at Felixstowe.',
        locationId: 'port-felixstowe',
      }),
      event(2, 'DISCHARGED', -h(44), {
        message: 'Container discharged at Felixstowe.',
        locationId: 'port-felixstowe',
      }),
      event(3, 'ENTRY_LODGED', -h(30), {
        message: 'Declaración de importación presentada en Felixstowe.',
        locationId: 'port-felixstowe',
      }),
    ],
  },
  {
    id: 'shipment-ma-016',
    accountId: 'account-norte',
    lane: {
      originSiteId: 'site-zaragoza',
      destinationLocationId: 'destination-casablanca',
      originPortId: 'port-valencia',
      roadOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 30,
    committedInHours: 24 * 4,
    documents: (s) => [
      document(s, 'packing_list', 'Lista de bultos ATL-MA-016', at(-h(30))),
      document(s, 'customs', 'Certificado de circulación EUR.1', at(-h(28))),
    ],
    events: (event) => [
      event(1, 'REC', -h(3), {
        message: 'RECOGIDA EFECTUADA PLATAFORMA ZARAGOZA',
        locationId: 'site-zaragoza',
      }),
      event(1, 'TRA', -h(1), {
        message: 'EN TRANSITO A-23 TERUEL',
        locationId: 'waypoint-a23-teruel',
      }),
    ],
  },
  {
    id: 'shipment-it-017',
    accountId: 'account-norte',
    lane: {
      originSiteId: 'site-zaragoza',
      destinationLocationId: 'destination-milano',
      originPortId: 'port-barcelona',
      roadOperatorId: 'operator-iberia',
    },
    createdHoursAgo: 48,
    committedInHours: 36,
    documents: (s) => [document(s, 'packing_list', 'Lista de bultos ATL-IT-017', at(-h(48)))],
    events: (event) => [
      event(1, 'PICKED_UP', -h(26), {
        message: 'Mercancía recogida en la plataforma de Zaragoza.',
        locationId: 'site-zaragoza',
      }),
      event(1, 'ON_ROUTE', -h(25), { message: 'En ruta por la AP-2 hacia el puerto.' }),
      event(1, 'DELIVERED', -h(22), {
        message: 'Entrega confirmada en la terminal del puerto de Barcelona.',
        locationId: 'port-barcelona',
      }),
      event(2, 'GATE_IN', -h(21.5), {
        message: 'Container gated in at Barcelona terminal.',
        locationId: 'port-barcelona',
      }),
      event(2, 'LOADED_ON_VESSEL', -h(1), {
        message: 'Container loaded on board.',
        payload: { eta: at(h(30)) },
        locationId: 'port-barcelona',
      }),
    ],
  },
  {
    // At sea without an operator ETA: the projection estimates an interval.
    id: 'shipment-it-018',
    accountId: 'account-levante',
    lane: {
      originSiteId: 'site-madrid',
      destinationLocationId: 'destination-milano',
      originPortId: 'port-valencia',
      roadOperatorId: 'operator-iberia',
      lastMileOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 120,
    committedInHours: 48,
    documents: (s) => [
      document(s, 'packing_list', 'Lista de bultos ATL-IT-018', at(-h(120))),
      document(s, 'bill_of_lading', 'Conocimiento de embarque BOR-IT-018', at(-h(14))),
    ],
    events: (event) => [
      event(1, 'PICKED_UP', -h(116), {
        message: 'Mercancía recogida en el centro de Madrid.',
        locationId: 'site-madrid',
      }),
      event(1, 'ON_ROUTE', -h(114), { message: 'En ruta por la A-3 hacia el puerto.' }),
      event(1, 'DELIVERED', -h(111), {
        message: 'Entrega confirmada en la terminal del puerto de Valencia.',
        locationId: 'port-valencia',
      }),
      event(2, 'GATE_IN', -h(110.5), {
        message: 'Container gated in at Valencia terminal.',
        locationId: 'port-valencia',
      }),
      event(2, 'LOADED_ON_VESSEL', -h(18), {
        message: 'Container loaded on board.',
        locationId: 'port-valencia',
      }),
      event(2, 'VESSEL_DEPARTED', -h(14), {
        message: 'Vessel departed Valencia.',
        locationId: 'port-valencia',
      }),
      event(2, 'NOON_REPORT', -h(6), {
        message: 'Noon report: Balearic Sea.',
        locationId: 'waypoint-sea-baleares',
      }),
    ],
  },
  {
    id: 'shipment-ma-019',
    accountId: 'account-atlantico',
    lane: {
      originSiteId: 'site-madrid',
      destinationLocationId: 'destination-casablanca',
      originPortId: 'port-algeciras',
      roadOperatorId: 'operator-iberia',
    },
    createdHoursAgo: 72,
    committedInHours: 12,
    documents: (s) => [
      document(s, 'packing_list', 'Lista de bultos ATL-MA-019', at(-h(72))),
      document(s, 'customs', 'Certificado de circulación EUR.1', at(-h(70))),
    ],
    events: (event) => [
      event(1, 'PICKED_UP', -h(68), {
        message: 'Mercancía recogida en el centro de Madrid.',
        locationId: 'site-madrid',
      }),
      event(1, 'ON_ROUTE', -h(64.5), {
        message: 'En ruta por la A-4 a la altura de Bailén.',
        locationId: 'waypoint-a4-bailen',
      }),
      event(1, 'DELIVERED', -h(60.5), {
        message: 'Entrega confirmada en la terminal del puerto de Algeciras.',
        locationId: 'port-algeciras',
      }),
      event(2, 'GATE_IN', -h(60), {
        message: 'Trailer gated in at Algeciras ferry terminal.',
        locationId: 'port-algeciras',
      }),
      event(2, 'LOADED_ON_VESSEL', -h(44), {
        message: 'Trailer loaded on board.',
        locationId: 'port-algeciras',
      }),
      event(2, 'VESSEL_DEPARTED', -h(43), {
        message: 'Vessel departed Algeciras.',
        locationId: 'port-algeciras',
      }),
      event(2, 'VESSEL_ARRIVED', -h(41.5), {
        message: 'Vessel arrived at Tanger Med.',
        locationId: 'port-tanger-med',
      }),
      event(2, 'DISCHARGED', -h(40), {
        message: 'Trailer discharged at Tanger Med.',
        locationId: 'port-tanger-med',
      }),
      event(3, 'ENTRY_LODGED', -h(38), {
        message: 'Declaración de importación presentada en Tanger Med.',
        locationId: 'port-tanger-med',
      }),
      event(3, 'CUSTOMS_RELEASED', -h(26), {
        message: 'Despacho concluido. Mercancía liberada para el transporte.',
        payload: { deliveryEta: at(h(2)) },
        locationId: 'port-tanger-med',
      }),
      event(3, 'TRUCK_DEPARTED', -h(3), {
        message: 'Camión en ruta hacia Casablanca.',
        locationId: 'port-tanger-med',
      }),
      event(3, 'CHECKPOINT', -h(1), {
        message: 'Paso por la A1 a la altura de Larache.',
        locationId: 'waypoint-a1-larache',
      }),
    ],
  },
  {
    id: 'shipment-es-020',
    accountId: 'account-levante',
    lane: {
      originSiteId: 'site-madrid',
      destinationLocationId: 'destination-valencia',
      roadOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 2,
    committedInHours: 8,
    events: (event) => [
      event(1, 'REC', -h(1), {
        message: 'RECOGIDA EFECTUADA CENTRO MADRID',
        locationId: 'site-madrid',
      }),
      event(1, 'TRA', -h(0.25), {
        message: 'EN TRANSITO A-3',
        payload: { llegadaPrevista: at(h(3.5)) },
      }),
    ],
  },
  {
    id: 'shipment-es-021',
    accountId: 'account-atlantico',
    lane: {
      originSiteId: 'site-madrid',
      destinationLocationId: 'destination-murcia',
      roadOperatorId: 'operator-iberia',
    },
    createdHoursAgo: 7,
    committedInHours: 3,
    events: (event) => [
      event(1, 'PICKED_UP', -h(4.5), {
        message: 'Mercancía recogida en el centro de Madrid.',
        locationId: 'site-madrid',
      }),
      event(1, 'ON_ROUTE', -h(1), {
        message: 'En ruta por la A-31 a la altura de Albacete.',
        payload: { arrivalAt: at(h(2)) },
        locationId: 'waypoint-a31-albacete',
      }),
      event(1, 'DELAYED', -h(0.5), {
        message: 'Retención por accidente en la A-30. Nueva hora de llegada.',
        payload: { arrivalAt: at(h(4)) },
      }),
    ],
  },
  {
    id: 'shipment-tr-022',
    accountId: 'account-atlantico',
    lane: {
      originSiteId: 'site-barcelona',
      destinationLocationId: 'destination-adana',
      originPortId: 'port-barcelona',
      roadOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 96,
    committedInHours: 24 * 5,
    documents: (s) => [
      document(s, 'packing_list', 'Lista de bultos ATL-TR-022', at(-h(96))),
      document(s, 'bill_of_lading', 'Conocimiento de embarque BOR-TR-022', at(-h(60))),
      document(s, 'customs', 'Certificado de circulación A.TR', at(-h(90))),
    ],
    events: (event) => [
      event(1, 'REC', -h(89.5), {
        message: 'RECOGIDA EFECTUADA PLANTA MARTORELL',
        locationId: 'site-barcelona',
      }),
      event(1, 'TRA', -h(89), { message: 'EN TRANSITO A PUERTO BCN' }),
      event(1, 'ENT', -h(88.5), {
        message: 'ENTREGADO TERMINAL PUERTO BARCELONA',
        locationId: 'port-barcelona',
      }),
      event(2, 'GATE_IN', -h(88), {
        message: 'Container gated in at Barcelona terminal.',
        locationId: 'port-barcelona',
      }),
      event(2, 'LOADED_ON_VESSEL', -h(64), {
        message: 'Container loaded on board.',
        locationId: 'port-barcelona',
      }),
      event(2, 'VESSEL_DEPARTED', -h(60), {
        message: 'Vessel departed Barcelona.',
        payload: { eta: at(h(24 * 4)) },
        locationId: 'port-barcelona',
      }),
      event(2, 'NOON_REPORT', -h(20), {
        message: 'Noon report: Strait of Sicily.',
        locationId: 'waypoint-sea-canal-sicilia',
      }),
    ],
  },
  {
    id: 'shipment-es-023',
    accountId: 'account-norte',
    lane: {
      originSiteId: 'site-barcelona',
      destinationLocationId: 'destination-sevilla',
      roadOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 12,
    committedInHours: 10,
    events: (event) => [
      event(1, 'REC', -h(9), {
        message: 'RECOGIDA EFECTUADA PLANTA MARTORELL',
        locationId: 'site-barcelona',
      }),
      event(1, 'TRA', -h(3), {
        message: 'EN TRANSITO A-7 VALENCIA',
        payload: { llegadaPrevista: at(h(7)) },
        locationId: 'waypoint-a7-valencia',
      }),
    ],
  },
  {
    id: 'shipment-gb-024',
    accountId: 'account-norte',
    lane: {
      originSiteId: 'site-zaragoza',
      destinationLocationId: 'destination-birmingham',
      originPortId: 'port-valencia',
      roadOperatorId: 'operator-cierzo',
    },
    createdHoursAgo: 48,
    committedInHours: 24 * 8,
    documents: (s) => [document(s, 'packing_list', 'Lista de bultos ATL-GB-024', at(-h(48)))],
    events: (event) => [
      event(1, 'REC', -h(28), {
        message: 'RECOGIDA EFECTUADA PLATAFORMA ZARAGOZA',
        locationId: 'site-zaragoza',
      }),
      event(1, 'TRA', -h(27.5), { message: 'EN TRANSITO A-23' }),
      event(1, 'ENT', -h(24.5), {
        message: 'ENTREGADO TERMINAL PUERTO VALENCIA',
        locationId: 'port-valencia',
      }),
      event(2, 'GATE_IN', -h(24), {
        message: 'Container gated in at Valencia terminal.',
        locationId: 'port-valencia',
      }),
      event(2, 'ETA_REVISED', -h(6), {
        message: 'Next sailing confirmed. Revised ETA.',
        payload: { eta: at(h(24 * 7)) },
      }),
    ],
  },
]

const referenceOf = (id: string) => `ATL-${id.replace('shipment-', '').toUpperCase()}`

function build(spec: ActiveSpec) {
  const base = makeShipment({
    id: spec.id,
    reference: referenceOf(spec.id),
    accountId: spec.accountId,
    lane: spec.lane,
    createdAt: at(-h(spec.createdHoursAgo)),
    committedDeliveryAt: at(h(spec.committedInHours)),
  })
  const documents = spec.documents?.(base) ?? []
  const shipment = withDocuments(base, documents)
  return { shipment, documents, events: spec.events(eventsFor(shipment)) }
}

const built = specs.map(build)

export const active: DataPart = {
  shipments: built.map((item) => item.shipment),
  events: built.flatMap((item) => item.events),
  documents: built.flatMap((item) => item.documents),
}
