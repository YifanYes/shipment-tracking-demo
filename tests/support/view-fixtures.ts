import { act, createElement, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type {
  Account,
  LegStage,
  LogisticsLocation,
  Operator,
  OperatorEvent,
  ShipmentDocument,
  ShipmentIncident,
  ShipmentLeg,
  ShipmentProjection,
  ShipmentView,
} from '@/domain/contracts'

/** Hand-built views for interface tests, independent from the demo dataset. */
export const viewCutoffAt = '2026-10-31T10:00:00Z'

export const accounts = {
  levante: { id: 'account-levante', name: 'Levante Retail' },
  norte: { id: 'account-norte', name: 'Norte Hogar' },
} satisfies Record<string, Account>

export const operators = {
  iberia: { id: 'operator-iberia', name: 'Vía Cargo', modes: ['road'] },
  mare: { id: 'operator-mare', name: 'Mare Lines', modes: ['sea'] },
  strada: { id: 'operator-strada', name: 'Strada Log', modes: ['road'] },
} satisfies Record<string, Operator>

const location = (
  id: string,
  name: string,
  kind: LogisticsLocation['kind'],
  placeLabel: string,
  countryCode = 'ES',
): LogisticsLocation => ({ id, name, kind, placeLabel, countryCode })

export const locations = {
  madrid: location('site-madrid', 'Centro Madrid', 'factory', 'Madrid'),
  zaragoza: location('site-zaragoza', 'Centro Zaragoza', 'warehouse', 'Zaragoza'),
  valencia: location('warehouse-valencia', 'Almacén Valencia', 'destination', 'Valencia'),
  sevilla: location('warehouse-sevilla', 'Almacén Sevilla', 'destination', 'Sevilla'),
  portValencia: location('port-valencia', 'Puerto de Valencia', 'port', 'Valencia'),
  portGenoa: location('port-genoa', 'Puerto de Génova', 'port', 'Génova', 'IT'),
  milan: location('warehouse-milan', 'Almacén Milán', 'destination', 'Milán', 'IT'),
}

const roadStages: LegStage[] = ['planned', 'collected', 'in_transit', 'completed']
const seaStages: LegStage[] = [
  'planned',
  'at_origin_terminal',
  'loaded',
  'in_transit',
  'at_destination_terminal',
  'completed',
]
const lastMileStages: LegStage[] = [
  'planned',
  'collected',
  'customs',
  'out_for_delivery',
  'completed',
]

const leg = (
  id: string,
  sequence: number,
  mode: ShipmentLeg['mode'],
  operatorId: string,
  originLocationId: string,
  destinationLocationId: string,
  milestones: LegStage[],
): ShipmentLeg => ({
  id,
  sequence,
  mode,
  operatorId,
  originLocationId,
  destinationLocationId,
  milestones,
})

export const event = (
  id: string,
  shipmentId: string,
  legId: string,
  operatorId: string,
  rawCode: string,
  occurredAt: string,
  extra: Partial<OperatorEvent> = {},
): OperatorEvent => ({
  id,
  shipmentId,
  legId,
  operatorId,
  rawCode,
  rawMessage: `Mensaje ${rawCode}`,
  payload: {},
  occurredAt,
  receivedAt: occurredAt,
  ...extra,
})

interface ViewInput {
  id: string
  reference: string
  account: Account
  origin: LogisticsLocation
  destination: LogisticsLocation
  committedDeliveryAt: string
  legs: readonly ShipmentLeg[]
  projection: Partial<ShipmentProjection>
  events?: readonly OperatorEvent[]
  documents?: readonly ShipmentDocument[]
  incidents?: readonly ShipmentIncident[]
  extraLocations?: readonly LogisticsLocation[]
}

export function makeView(input: ViewInput): ShipmentView {
  const legOperators = new Set(input.legs.map((entry) => entry.operatorId))
  const legLocations = new Set(
    input.legs.flatMap((entry) => [entry.originLocationId, entry.destinationLocationId]),
  )
  const documents = input.documents ?? []
  const incidents = input.incidents ?? []
  return {
    shipment: {
      id: input.id,
      reference: input.reference,
      accountId: input.account.id,
      originSiteId: input.origin.id,
      destinationLocationId: input.destination.id,
      createdAt: '2026-10-25T08:00:00Z',
      committedDeliveryAt: input.committedDeliveryAt,
      legs: input.legs,
      documentIds: documents.map((document) => document.id),
    },
    projection: {
      shipmentId: input.id,
      lifecycle: 'active',
      currentLegId: input.legs[0]?.id ?? null,
      currentStage: 'planned',
      eta: { kind: 'unavailable', reason: 'No hay una ETA comunicada por el operador.' },
      freshness: 'current',
      lastConfirmedLocation: null,
      legStages: Object.fromEntries(input.legs.map((entry) => [entry.id, 'planned'])),
      incidentIds: incidents
        .filter((incident) => incident.condition === 'active')
        .map((incident) => incident.id),
      unknownEventIds: [],
      ...input.projection,
    },
    events: input.events ?? [],
    account: input.account,
    origin: input.origin,
    destination: input.destination,
    operators: Object.values(operators).filter((operator) => legOperators.has(operator.id)),
    documents,
    locations: [
      ...Object.values(locations).filter((entry) => legLocations.has(entry.id)),
      ...(input.extraLocations ?? []),
    ],
    incidents,
  }
}

const multimodalLegs = (prefix: string) => [
  leg(
    `${prefix}-leg-1`,
    1,
    'road',
    operators.iberia.id,
    locations.zaragoza.id,
    locations.portValencia.id,
    roadStages,
  ),
  leg(
    `${prefix}-leg-2`,
    2,
    'sea',
    operators.mare.id,
    locations.portValencia.id,
    locations.portGenoa.id,
    seaStages,
  ),
  leg(
    `${prefix}-leg-3`,
    3,
    'road',
    operators.strada.id,
    locations.portGenoa.id,
    locations.milan.id,
    lastMileStages,
  ),
]

/** Road + sea + road, sailing, with an operator ETA later than the commitment. */
export const seaDelayed = makeView({
  id: 'shipment-sea',
  reference: 'ATL-IT-201',
  account: accounts.norte,
  origin: locations.zaragoza,
  destination: locations.milan,
  committedDeliveryAt: '2026-11-03T12:00:00Z',
  legs: multimodalLegs('sea'),
  events: [
    event(
      'sea-e1',
      'shipment-sea',
      'sea-leg-1',
      operators.iberia.id,
      'DELIVERED',
      '2026-10-27T10:00:00Z',
      {
        locationId: locations.portValencia.id,
      },
    ),
    event(
      'sea-e2',
      'shipment-sea',
      'sea-leg-2',
      operators.mare.id,
      'VSL_DEP',
      '2026-10-28T08:00:00Z',
      {
        payload: { arrivalAt: '2026-11-03T08:00:00Z' },
      },
    ),
    event(
      'sea-e3',
      'shipment-sea',
      'sea-leg-2',
      operators.mare.id,
      'VSL_ETA',
      '2026-10-30T09:00:00Z',
      {
        payload: { arrivalAt: '2026-11-04T18:00:00Z' },
      },
    ),
  ],
  projection: {
    currentLegId: 'sea-leg-2',
    currentStage: 'in_transit',
    legStages: { 'sea-leg-1': 'completed', 'sea-leg-2': 'in_transit', 'sea-leg-3': 'planned' },
    eta: {
      kind: 'operator',
      arrivalAt: '2026-11-04T18:00:00Z',
      issuedAt: '2026-10-30T09:00:00Z',
      operatorId: operators.mare.id,
      evidence: [{ kind: 'operator_event', id: 'sea-e3' }],
    },
    lastConfirmedLocation: {
      locationId: locations.portValencia.id,
      confirmedAt: '2026-10-27T10:00:00Z',
      evidence: { kind: 'operator_event', id: 'sea-e1' },
    },
  },
  incidents: [
    {
      id: 'incident-sea-delay',
      shipmentId: 'shipment-sea',
      legId: 'sea-leg-2',
      kind: 'delay',
      severity: 'medium',
      condition: 'active',
      attention: 'unreviewed',
      openedAt: '2026-10-30T09:00:00Z',
      evidence: [{ kind: 'operator_event', id: 'sea-e3' }],
    },
  ],
  documents: [
    {
      id: 'doc-sea-bl',
      shipmentId: 'shipment-sea',
      kind: 'bill_of_lading',
      name: 'BL ATL-IT-201',
      state: 'available',
      resourcePath: '/documents/bl-atl-it-201.pdf',
      uploadedAt: '2026-10-28T09:00:00Z',
    },
  ],
})

const customsBase = (documentState: ShipmentDocument['state']) => {
  const id = documentState === 'missing' ? 'shipment-customs' : 'shipment-customs-provided'
  const prefix = documentState === 'missing' ? 'cus' : 'cup'
  const documentId = `${prefix}-doc-customs`
  return makeView({
    id,
    reference: documentState === 'missing' ? 'ATL-IT-301' : 'ATL-IT-302',
    account: accounts.levante,
    origin: locations.zaragoza,
    destination: locations.milan,
    committedDeliveryAt: '2026-11-01T12:00:00Z',
    legs: multimodalLegs(prefix),
    events: [
      event(
        `${prefix}-e1`,
        id,
        `${prefix}-leg-3`,
        operators.strada.id,
        'CUS_HOLD',
        '2026-10-30T07:00:00Z',
        {
          rawMessage: 'Retenido en aduana CUS_HOLD: falta documento',
          locationId: locations.portGenoa.id,
        },
      ),
    ],
    projection: {
      currentLegId: `${prefix}-leg-3`,
      currentStage: 'customs',
      legStages: {
        [`${prefix}-leg-1`]: 'completed',
        [`${prefix}-leg-2`]: 'completed',
        [`${prefix}-leg-3`]: 'customs',
      },
      eta: { kind: 'unavailable', reason: 'Retención aduanera sin fecha de liberación.' },
      lastConfirmedLocation: {
        locationId: locations.portGenoa.id,
        confirmedAt: '2026-10-30T07:00:00Z',
        evidence: { kind: 'operator_event', id: `${prefix}-e1` },
      },
    },
    documents: [
      {
        id: documentId,
        shipmentId: id,
        kind: 'customs',
        name: 'DUA de importación',
        state: documentState,
        ...(documentState === 'available'
          ? { resourcePath: '/documents/dua.pdf', uploadedAt: '2026-10-31T08:00:00Z' }
          : {}),
      },
    ],
    incidents: [
      {
        id: `${prefix}-incident-customs`,
        shipmentId: id,
        legId: `${prefix}-leg-3`,
        kind: 'customs',
        severity: 'high',
        condition: 'active',
        attention: 'unreviewed',
        openedAt: '2026-10-30T07:00:00Z',
        evidence: [
          { kind: 'operator_event', id: `${prefix}-e1` },
          { kind: 'document', id: documentId },
        ],
      },
      {
        id: `${prefix}-incident-document`,
        shipmentId: id,
        kind: 'missing_document',
        severity: 'medium',
        condition: documentState === 'missing' ? 'active' : 'cleared',
        attention: 'unreviewed',
        openedAt: '2026-10-30T07:00:00Z',
        ...(documentState === 'available' ? { clearedAt: '2026-10-31T08:00:00Z' } : {}),
        evidence: [{ kind: 'document', id: documentId }],
      },
    ],
  })
}

/** Customs hold with the customs document still missing. */
export const customsHold = customsBase('missing')
/** Same hold after the document arrived: the hold stays until a release event. */
export const customsDocumentProvided = customsBase('available')

/** Road shipment without recent information, no ETA and an unclassified operator code. */
export const staleUnknown = makeView({
  id: 'shipment-stale',
  reference: 'ATL-ES-401',
  account: accounts.norte,
  origin: locations.madrid,
  destination: locations.sevilla,
  committedDeliveryAt: '2026-10-31T08:00:00Z',
  legs: [
    leg(
      'stale-leg-1',
      1,
      'road',
      operators.iberia.id,
      locations.madrid.id,
      locations.sevilla.id,
      roadStages,
    ),
  ],
  events: [
    event(
      'stale-e1',
      'shipment-stale',
      'stale-leg-1',
      operators.iberia.id,
      'PICKED_UP',
      '2026-10-30T06:00:00Z',
      {
        locationId: locations.madrid.id,
      },
    ),
    event(
      'stale-e2',
      'shipment-stale',
      'stale-leg-1',
      operators.iberia.id,
      'ZX_TEMP_99',
      '2026-10-30T09:00:00Z',
      {
        rawMessage: 'Sensor ZX_TEMP_99 fuera de rango',
        receivedAt: '2026-10-30T13:00:00Z',
      },
    ),
  ],
  projection: {
    currentLegId: 'stale-leg-1',
    currentStage: 'collected',
    legStages: { 'stale-leg-1': 'collected' },
    freshness: 'stale',
    eta: { kind: 'unavailable', reason: 'Sin ETA del operador en las últimas 24 h.' },
    unknownEventIds: ['stale-e2'],
    lastConfirmedLocation: {
      locationId: locations.madrid.id,
      confirmedAt: '2026-10-30T06:00:00Z',
      evidence: { kind: 'operator_event', id: 'stale-e1' },
    },
  },
})

/** Planned road shipment with an estimated arrival window. */
export const plannedEstimate = makeView({
  id: 'shipment-planned',
  reference: 'ATL-ES-501',
  account: accounts.levante,
  origin: locations.madrid,
  destination: locations.valencia,
  committedDeliveryAt: '2026-11-02T18:00:00Z',
  legs: [
    leg(
      'planned-leg-1',
      1,
      'road',
      operators.iberia.id,
      locations.madrid.id,
      locations.valencia.id,
      roadStages,
    ),
  ],
  projection: {
    lifecycle: 'planned',
    currentLegId: 'planned-leg-1',
    currentStage: 'planned',
    freshness: 'no_data',
    eta: {
      kind: 'estimate',
      earliestAt: '2026-11-02T08:00:00Z',
      latestAt: '2026-11-02T14:00:00Z',
      issuedAt: viewCutoffAt,
      assumptions: ['Recogida según el plan'],
      evidence: [],
    },
  },
})

/** Delivered road shipment, on time. */
export const delivered = makeView({
  id: 'shipment-delivered',
  reference: 'ATL-ES-001',
  account: accounts.levante,
  origin: locations.madrid,
  destination: locations.valencia,
  committedDeliveryAt: '2026-10-30T18:00:00Z',
  legs: [
    leg(
      'delivered-leg-1',
      1,
      'road',
      operators.iberia.id,
      locations.madrid.id,
      locations.valencia.id,
      roadStages,
    ),
  ],
  events: [
    event(
      'delivered-e1',
      'shipment-delivered',
      'delivered-leg-1',
      operators.iberia.id,
      'PICKED_UP',
      '2026-10-30T07:00:00Z',
    ),
    event(
      'delivered-e2',
      'shipment-delivered',
      'delivered-leg-1',
      operators.iberia.id,
      'ON_ROUTE',
      '2026-10-30T09:00:00Z',
    ),
    event(
      'delivered-e3',
      'shipment-delivered',
      'delivered-leg-1',
      operators.iberia.id,
      'DELIVERED',
      '2026-10-30T13:00:00Z',
      {
        locationId: locations.valencia.id,
      },
    ),
  ],
  projection: {
    lifecycle: 'delivered',
    currentLegId: 'delivered-leg-1',
    currentStage: 'completed',
    legStages: { 'delivered-leg-1': 'completed' },
    lastConfirmedLocation: {
      locationId: locations.valencia.id,
      confirmedAt: '2026-10-30T13:00:00Z',
      evidence: { kind: 'operator_event', id: 'delivered-e3' },
    },
  },
  documents: [
    {
      id: 'doc-delivered-note',
      shipmentId: 'shipment-delivered',
      kind: 'delivery_note',
      name: 'Albarán ATL-ES-001',
      state: 'available',
      resourcePath: '/documents/albaran-atl-es-001.pdf',
      uploadedAt: '2026-10-30T13:10:00Z',
    },
  ],
})

export const allViews = [
  seaDelayed,
  customsHold,
  customsDocumentProvided,
  staleUnknown,
  plannedEstimate,
  delivered,
]

export interface MountedView {
  container: HTMLDivElement
  unmount: () => void
}

/** Minimal React test renderer (no Testing Library in the project). */
export function renderView<P extends object>(Component: ComponentType<P>, props: P) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement('div')
  document.body.append(container)
  const root: Root = createRoot(container)
  const render = (next: P) =>
    act(() => {
      root.render(createElement(Component, next))
    })
  void render(props)
  return {
    container,
    rerender: render,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

export function click(element: Element | null | undefined) {
  if (!element) throw new Error('Elemento no encontrado')
  act(() => {
    ;(element as HTMLElement).click()
  })
}

export function buttonByText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')].find((entry) =>
    entry.textContent?.includes(text),
  )
}

/** Change a native select or input the way React listens to it. */
export function changeValue(element: HTMLInputElement | HTMLSelectElement | null, value: string) {
  if (!element) throw new Error('Control no encontrado')
  const prototype =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    )
  })
}

export function selectByLabel(container: HTMLElement, label: string) {
  const field = [...container.querySelectorAll('label')].find(
    (entry) => entry.querySelector('span')?.textContent === label,
  )
  return field?.querySelector('select') ?? null
}
