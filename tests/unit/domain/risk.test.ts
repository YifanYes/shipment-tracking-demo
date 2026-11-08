import { describe, expect, it } from 'vitest'
import { demoSeed } from '@/data/scenarios'
import { needsAction, attentionReasons, DELAY_RISK_REASON } from '@/domain/attention'
import { recordAction } from '@/domain/actions'
import type { DemoDataset } from '@/domain/contracts'
import { assessDelayRisk } from '@/domain/risk'
import { selectSummary, selectVisibleShipments } from '@/domain/selectors'
import { attentionQueue } from '@/features/overview/lib/attention'
import { applyScheduledEvents } from '@/simulation/clock'

const reference = Date.parse(demoSeed.dataset.referenceTime)
const atStep = (index: number) =>
  index < 0
    ? demoSeed.dataset.referenceTime
    : new Date(reference + demoSeed.steps[index]!.offsetMinutes * 60_000).toISOString()

function viewsAt(index: number, identityId = 'operations-network', dataset?: DemoDataset) {
  const cutoffAt = atStep(index)
  return {
    cutoffAt,
    dataset: dataset ?? applyScheduledEvents(demoSeed.dataset, demoSeed.scenarios, cutoffAt),
    views: selectVisibleShipments({
      dataset: dataset ?? applyScheduledEvents(demoSeed.dataset, demoSeed.scenarios, cutoffAt),
      identityId,
      cutoffAt,
      selectedShipmentId: null,
    }),
  }
}

const find = (views: ReturnType<typeof viewsAt>['views'], id: string) =>
  views.find((view) => view.shipment.id === id)!

describe('riesgo de retraso', () => {
  it('se anticipa al operador y desaparece cuando este confirma el retraso', () => {
    const start = viewsAt(-1)
    expect(assessDelayRisk(find(start.views, 'shipment-it-003'), start.cutoffAt)).toBeNull()

    const slowdown = viewsAt(0)
    const shipment = find(slowdown.views, 'shipment-it-003')
    const risk = assessDelayRisk(shipment, slowdown.cutoffAt)
    expect(risk?.level).toBe('medium')
    expect(risk?.factors.join(' ')).toContain('mal tiempo')
    expect(risk?.evidence).toHaveLength(1)

    const confirmed = viewsAt(1)
    const delayed = find(confirmed.views, 'shipment-it-003')
    expect(assessDelayRisk(delayed, confirmed.cutoffAt)).toBeNull()
    expect(delayed.incidents.some((item) => item.kind === 'delay')).toBe(true)
  })

  it('no modifica los hechos: la ETA del operador se mantiene y no abre incidencias', () => {
    const { views } = viewsAt(0)
    const shipment = find(views, 'shipment-it-003')
    expect(shipment.projection.eta.kind).toBe('operator')
    expect(shipment.projection.incidentIds).toEqual([])
  })

  it('es alto con una retención o sin noticias cerca del compromiso', () => {
    const { views, cutoffAt } = viewsAt(-1)
    expect(assessDelayRisk(find(views, 'shipment-tr-004'), cutoffAt)?.level).toBe('high')
    expect(assessDelayRisk(find(views, 'shipment-es-005'), cutoffAt)?.level).toBe('high')
  })

  it('solo señala una minoría de los envíos abiertos en cada paso', () => {
    for (let index = -1; index < demoSeed.steps.length; index++) {
      const { views, cutoffAt } = viewsAt(index)
      const open = views.filter((view) => view.projection.lifecycle !== 'delivered')
      const flagged = open.filter((view) => assessDelayRisk(view, cutoffAt))
      expect(flagged.length).toBeLessThanOrEqual(Math.max(3, open.length / 3))
    }
  })

  it('propone confirmar con el operador y lleva el envío a la bandeja', () => {
    const { views, cutoffAt, dataset } = viewsAt(0)
    const shipment = find(views, 'shipment-it-003')
    expect(attentionReasons(shipment, cutoffAt)).toContain(DELAY_RISK_REASON)
    expect(needsAction(shipment, cutoffAt)).toBe(true)
    const action = shipment.recommendations.find((item) => item.kind === 'contact_operator')!
    expect(action.message).toContain('mal tiempo')

    const next = recordAction({
      dataset,
      view: shipment,
      actionId: action.id,
      actorIdentityId: 'operations-network',
      at: cutoffAt,
    })
    const after = find(
      selectVisibleShipments({
        dataset: next,
        identityId: 'operations-network',
        cutoffAt,
        selectedShipmentId: null,
      }),
      'shipment-it-003',
    )
    expect(attentionReasons(after, cutoffAt)).toContain(DELAY_RISK_REASON)
    expect(needsAction(after, cutoffAt)).toBe(false)
  })
})

describe('clasificación de códigos desconocidos', () => {
  const unknownStep = 1

  it('propone un significado sin dar por confirmado ningún hito', () => {
    const { views, cutoffAt, dataset } = viewsAt(unknownStep)
    const shipment = find(views, 'shipment-es-005')
    const action = shipment.recommendations.find((item) => item.kind === 'classify_event')!
    expect(action.subject).toBe('Parada en base del operador')
    expect(action.explanation).toContain('Confianza media')
    expect(attentionReasons(shipment, cutoffAt)).toContain('Evento pendiente de clasificar')

    const next = recordAction({
      dataset,
      view: shipment,
      actionId: action.id,
      actorIdentityId: 'operations-network',
      at: cutoffAt,
    })
    const after = find(
      selectVisibleShipments({
        dataset: next,
        identityId: 'operations-network',
        cutoffAt,
        selectedShipmentId: null,
      }),
      'shipment-es-005',
    )
    expect(attentionReasons(after, cutoffAt)).not.toContain('Evento pendiente de clasificar')
    expect(after.recommendations.some((item) => item.kind === 'classify_event')).toBe(false)
    expect(after.projection).toEqual(shipment.projection)
  })

  it('deja de proponerlo cuando un evento conocido posterior lo supera', () => {
    const shipment = find(viewsAt(2).views, 'shipment-es-005')
    expect(shipment.recommendations.some((item) => item.kind === 'classify_event')).toBe(false)
  })
})

describe('bandeja de atención', () => {
  it('pone lo que se puede gestionar antes que lo que espera al operador', () => {
    const { views, cutoffAt, dataset } = viewsAt(-1)
    const top = attentionQueue(views, cutoffAt)[0]!
    let next = dataset
    for (const action of top.recommendations)
      next = recordAction({
        dataset: next,
        view: top,
        actionId: action.id,
        actorIdentityId: 'operations-network',
        at: cutoffAt,
      })
    const handled = selectVisibleShipments({
      dataset: next,
      identityId: 'operations-network',
      cutoffAt,
      selectedShipmentId: null,
    })
    const queue = attentionQueue(handled, cutoffAt)
    expect(queue[0]!.shipment.id).not.toBe(top.shipment.id)
    expect(queue.at(-1)!.shipment.id).toBe(top.shipment.id)
    expect(selectSummary(handled, cutoffAt).attention).toBe(
      selectSummary(views, cutoffAt).attention - 1,
    )
  })

  it('propone pedir la recogida cuando un envío no tiene ningún evento', () => {
    const { views } = viewsAt(-1)
    const action = find(views, 'shipment-es-011').recommendations[0]!
    expect(action.title).toBe('Confirmar la recogida con el operador')
  })
})
