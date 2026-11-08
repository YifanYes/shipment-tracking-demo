import type { DemoDataset, DemoScenario } from '@/domain/contracts'
import { at, clockAt, hours } from './builders'
import { referenceTime } from './network'
import madridValenciaRoute from './routes/madrid-valencia.json'

export const nationalDataset: DemoDataset = {
  revision: 1,
  referenceTime,
  accounts: [
    { id: 'account-norte', name: 'Norte Hogar' },
    { id: 'account-levante', name: 'Levante Retail' },
  ],
  identities: [
    {
      id: 'operations-madrid',
      name: 'Operaciones Madrid',
      role: 'operations',
      allowedOriginSiteIds: ['site-madrid'],
      allowedAccountIds: ['account-norte'],
    },
    {
      id: 'customer-levante',
      name: 'Cliente · Levante Retail',
      role: 'customer',
      accountId: 'account-levante',
    },
  ],
  locations: [
    {
      id: 'site-madrid',
      name: 'Centro Madrid',
      kind: 'warehouse',
      placeLabel: 'Madrid',
      countryCode: 'ES',
      coordinates: [-3.7038, 40.4168],
    },
    {
      id: 'destination-valencia',
      name: 'Almacén Valencia',
      kind: 'destination',
      placeLabel: 'Valencia',
      countryCode: 'ES',
      coordinates: [-0.3763, 39.4699],
    },
    {
      id: 'waypoint-a3-perales',
      name: 'A-3 · Perales de Tajuña',
      kind: 'waypoint',
      placeLabel: 'Perales de Tajuña',
      countryCode: 'ES',
      coordinates: [-3.220108, 40.148136],
    },
  ],
  operators: [{ id: 'operator-iberia', name: 'Vía Cargo', modes: ['road'] }],
  shipments: [
    {
      id: 'shipment-es-001',
      reference: 'ATL-ES-001',
      accountId: 'account-norte',
      originSiteId: 'site-madrid',
      destinationLocationId: 'destination-valencia',
      createdAt: at(-hours(4)),
      committedDeliveryAt: at(hours(4)),
      legs: [
        {
          id: 'leg-es-001-road',
          sequence: 1,
          mode: 'road',
          operatorId: 'operator-iberia',
          originLocationId: 'site-madrid',
          destinationLocationId: 'destination-valencia',
          milestones: ['planned', 'collected', 'in_transit', 'out_for_delivery', 'completed'],
          route: {
            coordinates: madridValenciaRoute.map(([longitude, latitude]) => [
              longitude!,
              latitude!,
            ]),
            source: 'OSRM · OpenStreetMap',
          },
        },
      ],
      documentIds: [],
    },
  ],
  events: [
    {
      id: 'event-es-001-collected',
      shipmentId: 'shipment-es-001',
      legId: 'leg-es-001-road',
      operatorId: 'operator-iberia',
      rawCode: 'PICKED_UP',
      rawMessage: 'Mercancía recogida en el centro de Madrid.',
      payload: {},
      occurredAt: at(-hours(2)),
      receivedAt: at(-hours(2) + 2),
      locationId: 'site-madrid',
    },
    {
      id: 'event-es-001-transit',
      shipmentId: 'shipment-es-001',
      legId: 'leg-es-001-road',
      operatorId: 'operator-iberia',
      rawCode: 'ON_ROUTE',
      rawMessage: `En ruta por la A-3 a la altura de Perales de Tajuña. Llegada prevista a las ${clockAt(hours(2))}, hora peninsular.`,
      payload: { arrivalAt: at(hours(2)) },
      occurredAt: at(-1),
      receivedAt: new Date(Date.parse(at(-1)) + 10_000).toISOString(),
      locationId: 'waypoint-a3-perales',
    },
  ],
  documents: [],
}

export const nationalScenario: DemoScenario = {
  id: 'national-on-time',
  name: 'Entrega nacional a tiempo',
  shipmentIds: ['shipment-es-001'],
  scheduledEvents: [
    {
      offsetMinutes: 120,
      event: {
        id: 'event-es-001-delivered',
        shipmentId: 'shipment-es-001',
        legId: 'leg-es-001-road',
        operatorId: 'operator-iberia',
        rawCode: 'DELIVERED',
        rawMessage: 'Entrega confirmada en el almacén de Valencia.',
        payload: {},
        occurredAt: at(hours(2)),
        receivedAt: at(hours(2)),
        locationId: 'destination-valencia',
      },
    },
  ],
}
