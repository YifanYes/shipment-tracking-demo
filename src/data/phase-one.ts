import type { DemoDataset, DemoScenario } from '@/domain/contracts'

export const phaseOneDataset: DemoDataset = {
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
      scenePosition: [-4, 0, 0],
    },
    {
      id: 'destination-valencia',
      name: 'Almacén Valencia',
      kind: 'destination',
      placeLabel: 'Valencia',
      countryCode: 'ES',
      scenePosition: [4, 0, 0],
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
      rawMessage: 'Salida de Madrid hacia Valencia. Llegada prevista a las 13:00, hora peninsular.',
      payload: { arrivalAt: '2026-10-31T12:00:00.000Z' },
      occurredAt: '2026-10-31T09:30:00.000Z',
      receivedAt: '2026-10-31T09:32:00.000Z',
      locationId: 'site-madrid',
    },
  ],
  documents: [],
}

export const phaseOneScenario: DemoScenario = {
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
