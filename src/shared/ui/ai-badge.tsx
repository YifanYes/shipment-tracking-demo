import { Sparkles } from 'lucide-react'

/** Marks content produced by the AI layer, so it is never mistaken for a confirmed fact. */
export function AiBadge({ label = 'IA' }: { label?: string }) {
  return (
    <span className="ai-badge">
      <Sparkles size={10} aria-hidden="true" />
      {label}
    </span>
  )
}
