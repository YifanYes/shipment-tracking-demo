import type { LegStage } from '@/domain/contracts'

export const stageLabels: Record<LegStage, string> = {
  planned: 'Planificado',
  collected: 'Recogido',
  at_origin_terminal: 'En terminal de origen',
  loaded: 'Cargado',
  in_transit: 'En tránsito',
  at_destination_terminal: 'En terminal de destino',
  customs: 'En aduana',
  out_for_delivery: 'En reparto',
  completed: 'Entregado',
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function updateAge(confirmedAt: string | undefined, cutoffAt: string) {
  if (!confirmedAt) return 'Sin ubicación confirmada'
  const minutes = Math.max(0, Math.floor((Date.parse(cutoffAt) - Date.parse(confirmedAt)) / 60_000))
  if (minutes < 1) return 'Actualizado ahora'
  if (minutes < 60) return `Actualizado hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Actualizado hace ${hours} h`
  return `Actualizado hace ${Math.floor(hours / 24)} días`
}
