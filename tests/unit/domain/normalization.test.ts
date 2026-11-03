import { describe, expect, it } from 'vitest'
import type { NormalizedSignal, OperatorEvent } from '@/domain/contracts'
import { normalizeEvent } from '@/domain/events'

const raw = (operatorId: string, rawCode: string, payload: OperatorEvent['payload'] = {}) =>
  ({
    id: `event-${operatorId}-${rawCode}`,
    shipmentId: 'shipment',
    legId: 'leg',
    operatorId,
    rawCode,
    rawMessage: rawCode,
    payload,
    occurredAt: '2026-10-31T08:00:00.000Z',
    receivedAt: '2026-10-31T08:00:00.000Z',
  }) satisfies OperatorEvent

const signals = (event: OperatorEvent): readonly NormalizedSignal[] => {
  const result = normalizeEvent(event)
  return result.mapping === 'known' ? result.signals : []
}

describe('vocabularios de los operadores', () => {
  it('interpreta códigos distintos de forma común', () => {
    const collected = [{ kind: 'progress', stage: 'collected' }]
    expect(signals(raw('operator-iberia', 'PICKED_UP'))).toEqual(collected)
    expect(signals(raw('operator-cierzo', 'REC'))).toEqual(collected)

    const delay = { kind: 'incident_opened', incidentKind: 'delay' }
    for (const [operator, code] of [
      ['operator-iberia', 'DELAYED'],
      ['operator-cierzo', 'RET'],
      ['operator-boreal', 'DELAY_NOTICE'],
    ] as const)
      expect(signals(raw(operator, code))).toEqual([delay])

    const arrivalAt = '2026-11-01T12:00:00.000Z'
    const eta = { kind: 'eta_updated', arrivalAt }
    expect(signals(raw('operator-iberia', 'ETA_UPDATE', { arrivalAt }))).toEqual([eta])
    expect(signals(raw('operator-cierzo', 'ETA', { llegadaPrevista: arrivalAt }))).toEqual([eta])
    expect(signals(raw('operator-boreal', 'ETA_REVISED', { eta: arrivalAt }))).toEqual([eta])
    expect(signals(raw('operator-puente', 'NEW_ETA', { deliveryEta: arrivalAt }))).toEqual([eta])
  })

  it('separa retención, documento y liberación aduanera', () => {
    expect(signals(raw('operator-puente', 'CUSTOMS_HOLD'))).toEqual([
      { kind: 'progress', stage: 'customs' },
      { kind: 'incident_opened', incidentKind: 'customs' },
    ])
    expect(signals(raw('operator-puente', 'DOC_REQUIRED'))).toEqual([
      { kind: 'incident_opened', incidentKind: 'missing_document' },
    ])
    expect(signals(raw('operator-puente', 'CUSTOMS_RELEASED'))).toContainEqual({
      kind: 'incident_cleared',
      incidentKind: 'customs',
    })
  })

  it('deja pendientes los códigos ajenos al vocabulario del operador', () => {
    expect(normalizeEvent(raw('operator-cierzo', 'ZZ-07')).mapping).toBe('unknown')
    // A valid code of another operator is not part of this operator's vocabulary.
    expect(normalizeEvent(raw('operator-boreal', 'REC')).mapping).toBe('unknown')
    expect(normalizeEvent(raw('operator-unknown', 'PICKED_UP')).mapping).toBe('unknown')
    // The ETA key also belongs to the operator: Vía Cargo's key means nothing to Boreal.
    expect(
      normalizeEvent(raw('operator-boreal', 'ETA_REVISED', { arrivalAt: '2026-11-01T12:00:00Z' }))
        .mapping,
    ).toBe('unknown')
    expect(
      normalizeEvent(raw('operator-cierzo', 'ETA', { llegadaPrevista: 'mañana' })).mapping,
    ).toBe('unknown')
  })
})
