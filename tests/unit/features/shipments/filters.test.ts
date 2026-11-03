import { describe, expect, it } from 'vitest'
import {
  emptyShipmentFilters,
  filterShipments,
  hasActiveFilters,
  shipmentFilterOptions,
  sortShipments,
  type ShipmentFilters,
} from '@/features/shipments/lib/filters'
import {
  allViews,
  customsDocumentProvided,
  customsHold,
  delivered,
  plannedEstimate,
  seaDelayed,
  staleUnknown,
  viewCutoffAt,
} from '@tests/support/view-fixtures'

const ids = (filters: Partial<ShipmentFilters>) =>
  filterShipments(allViews, { ...emptyShipmentFilters, ...filters }, viewCutoffAt).map(
    (view) => view.shipment.reference,
  )

describe('filtros del listado de envíos', () => {
  it('busca por referencia, cuenta y lugares sin distinguir acentos', () => {
    expect(ids({ query: 'atl-it-201' })).toEqual(['ATL-IT-201'])
    expect(ids({ query: 'norte' })).toEqual(['ATL-IT-201', 'ATL-ES-401'])
    // Intermediate port of the sea leg, not the shipment origin or destination.
    expect(ids({ query: 'genova' })).toEqual(['ATL-IT-201', 'ATL-IT-301', 'ATL-IT-302'])
    expect(ids({ query: 'sevilla madrid' })).toEqual(['ATL-ES-401'])
  })

  it('filtra por centro, cuenta, operador y modo', () => {
    expect(ids({ originSiteId: 'site-madrid' })).toEqual(['ATL-ES-401', 'ATL-ES-501', 'ATL-ES-001'])
    expect(ids({ accountId: 'account-levante', mode: 'multimodal' })).toEqual([
      'ATL-IT-301',
      'ATL-IT-302',
    ])
    expect(ids({ operatorId: 'operator-mare' })).toHaveLength(3)
    expect(ids({ mode: 'sea' })).toEqual([])
  })

  it('filtra por progreso, etapa y riesgo', () => {
    expect(ids({ progress: 'delivered' })).toEqual(['ATL-ES-001'])
    expect(ids({ progress: 'planned' })).toEqual(['ATL-ES-501'])
    expect(ids({ progress: 'open' })).not.toContain('ATL-ES-001')
    expect(ids({ progress: 'stage:customs' })).toEqual(['ATL-IT-301', 'ATL-IT-302'])
    expect(ids({ risk: 'attention' })).toEqual(
      expect.arrayContaining(['ATL-IT-201', 'ATL-IT-301', 'ATL-ES-401']),
    )
    expect(ids({ risk: 'clear' })).toContain('ATL-ES-001')
  })

  it('deriva las opciones solo de las vistas visibles', () => {
    const options = shipmentFilterOptions([staleUnknown, delivered])
    expect(options.origins.map((option) => option.label)).toEqual(['Centro Madrid'])
    expect(options.operators.map((option) => option.label)).toEqual(['Vía Cargo'])
    expect(options.modes).toEqual([{ value: 'road', label: 'Carretera' }])
    expect(options.stages.map((option) => option.value)).toEqual(['stage:collected'])
    expect(shipmentFilterOptions(allViews).modes.map((option) => option.label)).toEqual([
      'Carretera',
      'Combinado',
    ])
  })

  it('ordena por atención y deja las entregas al final', () => {
    const order = sortShipments(
      [delivered, plannedEstimate, seaDelayed, customsHold, customsDocumentProvided, staleUnknown],
      viewCutoffAt,
    ).map((view) => view.shipment.reference)
    expect(order.at(-1)).toBe('ATL-ES-001')
    expect(order.indexOf('ATL-ES-501')).toBe(order.length - 2)
  })

  it('detecta si hay filtros aplicados', () => {
    expect(hasActiveFilters(emptyShipmentFilters)).toBe(false)
    expect(hasActiveFilters({ ...emptyShipmentFilters, query: '  ' })).toBe(false)
    expect(hasActiveFilters({ ...emptyShipmentFilters, risk: 'attention' })).toBe(true)
  })
})
