import type { DemoDataset, DemoScenario } from '@/domain/contracts'
import madridValenciaRoute from './routes/madrid-valencia.json'

export const nationalDataset: DemoDataset = {
  revision: 1,
  referenceTime: '2026-10-31T10:00:00.000Z',
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
      createdAt: '2026-10-31T06:00:00.000Z',
      committedDeliveryAt: '2026-10-31T14:00:00.000Z',
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
      occurredAt: '2026-10-31T08:00:00.000Z',
      receivedAt: '2026-10-31T08:02:00.000Z',
      locationId: 'site-madrid',
    },
    {
      id: 'event-es-001-transit',
      shipmentId: 'shipment-es-001',
      legId: 'leg-es-001-road',
      operatorId: 'operator-iberia',
      rawCode: 'ON_ROUTE',
      rawMessage:
        'En ruta por la A-3 a la altura de Perales de Tajuña. Llegada prevista a las 13:00, hora peninsular.',
      payload: { arrivalAt: '2026-10-31T12:00:00.000Z' },
      occurredAt: '2026-10-31T09:59:00.000Z',
      receivedAt: '2026-10-31T09:59:10.000Z',
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
        occurredAt: '2026-10-31T12:00:00.000Z',
        receivedAt: '2026-10-31T12:00:00.000Z',
        locationId: 'destination-valencia',
      },
    },
  ],
}
