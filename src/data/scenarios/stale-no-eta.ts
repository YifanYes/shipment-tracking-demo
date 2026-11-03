import type { DemoScenario } from '@/domain/contracts'
import { at, eventsFor, hours, makeShipment, scheduled, type DataPart } from './builders'

/** Madrid → A Coruña by road. No news since yesterday and the operator ETA has expired. */
const shipment = makeShipment({
  id: 'shipment-es-005',
  reference: 'ATL-ES-005',
  accountId: 'account-atlantico',
  lane: {
    originSiteId: 'site-madrid',
    destinationLocationId: 'destination-a-coruna',
    roadOperatorId: 'operator-cierzo',
  },
  createdAt: at(-hours(30)),
  committedDeliveryAt: at(hours(8)),
})
const event = eventsFor(shipment)

export const staleNoEta: DataPart = {
  shipments: [shipment],
  documents: [],
  events: [
    event(1, 'REC', -hours(27), {
      message: 'RECOGIDA EFECTUADA CENTRO MADRID',
      locationId: 'site-madrid',
    }),
    event(1, 'TRA', -hours(23), {
      message: 'EN TRANSITO A-6 BENAVENTE',
      payload: { llegadaPrevista: at(-hours(19)) },
      locationId: 'waypoint-a6-benavente',
    }),
  ],
}

export const staleNoEtaScenario: DemoScenario = {
  id: 'stale-no-eta',
  name: 'Sin actualizaciones ni ETA fiable',
  shipmentIds: [shipment.id],
  scheduledEvents: [
    // Not in Cierzo's vocabulary: it stays pending classification and does not refresh the data.
    scheduled(90, event(1, 'ZZ-07', 88, { message: 'ZZ-07 BASE BENAVENTE' })),
    scheduled(
      180,
      event(1, 'TRA', 180, {
        message: 'EN TRANSITO A-6 BENAVENTE TRAS AVERIA',
        payload: { llegadaPrevista: at(hours(7.5)) },
        locationId: 'waypoint-a6-benavente',
        key: 'tra-2',
      }),
    ),
    scheduled(390, event(1, 'REP', 390, { message: 'EN REPARTO A CORUÑA' })),
    scheduled(
      435,
      event(1, 'ENT', 435, {
        message: 'ENTREGADO ALMACEN A CORUÑA',
        locationId: 'destination-a-coruna',
      }),
    ),
  ],
}
