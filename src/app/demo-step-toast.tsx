import type { ShipmentChanges } from '@/domain/changes'
import type { DemoStep, ShipmentView } from '@/domain/contracts'
import { stepLabel } from '@/simulation/clock'
import { toastManager } from '@/shared/ui/toast'

function deliveries(references: readonly string[], late: readonly string[], other: boolean) {
  if (!references.length) return null
  const count = references.length
  const text = `${count} ${count === 1 ? 'envío entregado' : 'envíos entregados'}`
  const delayed = late.length ? ` (${late.length} con retraso)` : ''
  return other
    ? `Además, ${text}${delayed}.`
    : `${text[0]!.toUpperCase()}${text.slice(1)}${delayed}.`
}

/**
 * One headline per step. The story is told only if its shipment is visible to the identity;
 * everything else is reduced to the number of deliveries in the user's perimeter.
 */
export function announceStep(
  step: DemoStep,
  changes: ShipmentChanges,
  visible: readonly ShipmentView[],
) {
  const story = step.story
  const main = story && visible.find((view) => view.shipment.id === story.shipmentId)
  const others = main
    ? changes.delivered.filter((reference) => reference !== main.shipment.reference)
    : changes.delivered
  const late = changes.late.filter((reference) => others.includes(reference))
  const summary = deliveries(others, late, Boolean(main))
  toastManager.add({
    title: main ? story.title : stepLabel(step, visible, 'Paso completado'),
    description:
      [main ? story.detail : null, summary].filter(Boolean).join(' ') ||
      'Sin cambios en tus envíos.',
    timeout: 8000,
  })
}
