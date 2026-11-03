import { describe, expect, it } from 'vitest'
import type { DemoDataset } from '@/domain/contracts'
import { demoSeed } from '@/data/scenarios'
import { at, hours } from '@/data/scenarios/builders'
import { deriveIncidents } from '@/domain/incidents'
import { projectShipment, staleThresholdHours } from '@/domain/projection'
import { applyScheduledEvents } from '@/simulation/clock'

const { dataset, scenarios } = demoSeed
const reference = dataset.referenceTime
const shipment = (id: string) => dataset.shipments.find((item) => item.id === id)!
const project = (id: string, cutoffAt = reference, data: DemoDataset = dataset) =>
  projectShipment(data, shipment(id), cutoffAt)
const incidents = (id: string, cutoffAt = reference, data: DemoDataset = dataset) =>
  deriveIncidents(data, shipment(id), cutoffAt)
const advanced = (cutoffAt: string) => applyScheduledEvents(dataset, scenarios, cutoffAt)

describe('retención aduanera', () => {
  const id = 'shipment-tr-004'
  const certificate = 'document-tr-004-customs'
  const provided = {
    ...dataset,
    documents: dataset.documents.map((item) =>
      item.id === certificate
        ? { ...item, state: 'available' as const, uploadedAt: reference }
        : item,
    ),
  }

  it('aportar el documento resuelve la tarea documental sin liberar la mercancía', () => {
    const before = project(id)
    expect(before).toMatchObject({ currentStage: 'customs', lifecycle: 'active' })
    expect(
      incidents(id)
        .filter((item) => item.condition === 'active')
        .map((i) => i.kind),
    ).toEqual(['customs', 'missing_document'])
    const after = project(id, reference, provided)
    expect(after.currentStage).toBe('customs')
    expect(after.legStages).toEqual(before.legStages)
    const result = incidents(id, reference, provided)
    expect(result.find((item) => item.kind === 'missing_document')).toMatchObject({
      condition: 'cleared',
      clearedAt: reference,
      evidence: expect.arrayContaining([{ kind: 'document', id: certificate }]),
    })
    expect(result.find((item) => item.kind === 'customs')?.condition).toBe('active')
  })

  it('la liberación del operador cambia el progreso aunque falte el documento', () => {
    const releasedAt = at(hours(26))
    const data = advanced(releasedAt)
    expect(project(id, releasedAt, data).currentStage).toBe('collected')
    const result = incidents(id, releasedAt, data)
    expect(result.find((item) => item.kind === 'customs')).toMatchObject({ condition: 'cleared' })
    expect(result.find((item) => item.kind === 'missing_document')?.condition).toBe('active')
  })

  it('la retención repetida es una sola incidencia con ID estable', () => {
    const customs = incidents(id).filter((item) => item.kind === 'customs')
    expect(customs).toHaveLength(1)
    expect(customs[0]!.evidence).toHaveLength(1)
    expect(incidents(id, at(60))[0]!.id).toBe(incidents(id)[0]!.id)
    expect(customs[0]).toMatchObject({ severity: 'high', attention: 'unreviewed' })
  })
})

describe('ETA', () => {
  it('conserva la fuente, estima con supuestos o explica su ausencia', () => {
    expect(project('shipment-es-006').eta).toMatchObject({
      kind: 'operator',
      operatorId: 'operator-iberia',
      evidence: [{ kind: 'operator_event' }],
    })
    const estimate = project('shipment-it-018').eta
    expect(estimate.kind).toBe('estimate')
    if (estimate.kind === 'estimate') {
      expect(Date.parse(estimate.earliestAt)).toBeLessThan(Date.parse(estimate.latestAt))
      expect(Date.parse(estimate.earliestAt)).toBeGreaterThan(Date.parse(reference))
      expect(estimate.assumptions.length).toBeGreaterThan(0)
    }
    for (const id of ['shipment-es-005', 'shipment-tr-004', 'shipment-ma-002', 'shipment-es-011'])
      expect(project(id).eta.kind).toBe('unavailable')
    expect(project('shipment-es-005').eta).toMatchObject({
      reason: expect.stringContaining('vencido'),
    })
    expect(project('shipment-tr-004').eta).toMatchObject({
      reason: expect.stringContaining('Retenido'),
    })
  })

  it('la nueva ETA del operador abre un retraso que se cierra con la entrega', () => {
    const id = 'shipment-it-003'
    expect(incidents(id)).toEqual([])
    const noticeAt = at(90)
    expect(project(id, noticeAt, advanced(noticeAt)).eta).toMatchObject({
      kind: 'operator',
      arrivalAt: at(hours(44)),
    })
    const [delay] = incidents(id, noticeAt, advanced(noticeAt))
    expect(delay).toMatchObject({ kind: 'delay', condition: 'active', severity: 'medium' })
    const end = at(hours(42.25))
    const final = incidents(id, end, advanced(end))
    expect(final).toEqual([
      { ...delay, condition: 'cleared', clearedAt: end, evidence: expect.any(Array) },
    ])
  })
})

describe('antigüedad de la información por contexto', () => {
  const cases = [
    // [shipment, context, hours since its last known event at the reference]
    ['shipment-es-006', 'road', 1],
    ['shipment-tr-013', 'port', 10],
    ['shipment-gb-014', 'sea', 6],
    ['shipment-gb-015', 'customs', 30],
  ] as const
  it.each(cases)('%s aplica el umbral de %s', (id, context, since) => {
    const threshold = staleThresholdHours[context]
    expect(project(id, at(hours(threshold - since - 0.5))).freshness).toBe('current')
    expect(project(id, at(hours(threshold - since + 0.5))).freshness).toBe('stale')
  })

  it('un código desconocido no refresca la información; un evento conocido sí', () => {
    const id = 'shipment-es-005'
    expect(incidents(id)).toMatchObject([{ kind: 'stale', condition: 'active', severity: 'high' }])
    const unknownAt = at(90)
    expect(project(id, unknownAt, advanced(unknownAt))).toMatchObject({
      freshness: 'stale',
      unknownEventIds: ['event-es-005-1-zz-07'],
    })
    const freshAt = at(180)
    expect(project(id, freshAt, advanced(freshAt))).toMatchObject({
      freshness: 'current',
      eta: { kind: 'operator' },
    })
    expect(incidents(id, freshAt, advanced(freshAt))).toEqual([])
  })
})

describe('orden de los hechos', () => {
  it('un evento antiguo recibido tarde se incorpora sin retroceder', () => {
    const id = 'shipment-it-003'
    const leg = 'leg-it-003-2'
    const beforeReceipt = project(id, at(-hours(10)))
    expect(beforeReceipt.legStages[leg]).toBe('in_transit')
    expect(project(id).legStages[leg]).toBe('in_transit')
    expect(project(id).lastConfirmedLocation?.locationId).toBe('waypoint-sea-golfo-leon')
  })

  it('una entrega pasada la fecha comprometida mantiene un retraso abierto', () => {
    const after = at(hours(25))
    expect(incidents('shipment-tr-004', after, advanced(after))).toContainEqual(
      expect.objectContaining({ id: 'incident-shipment-tr-004-overdue', condition: 'active' }),
    )
  })
})
