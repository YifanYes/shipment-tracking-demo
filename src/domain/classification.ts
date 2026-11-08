import type { CodeSuggestion, OperatorEvent } from './contracts'

/** Mock of an LLM reading the raw message of a code outside the operator's vocabulary. */
const rules: readonly (Omit<CodeSuggestion, 'code'> & { pattern: RegExp })[] = [
  {
    pattern: /\bBASE\b|\bDEPOT\b|PARADA/i,
    interpretation: 'Parada en base del operador',
    confidence: 'media',
    rationale: 'El mensaje menciona una base y no confirma avance.',
  },
  {
    pattern: /ADUANA|CUSTOMS/i,
    interpretation: 'Trámite de aduana',
    confidence: 'media',
    rationale: 'El mensaje menciona la aduana, sin indicar retención ni liberación.',
  },
]

/**
 * A proposal for a person to review. Accepting it clears the classification task but adds no
 * milestone: the shipment only moves with a known operator event.
 */
export function suggestClassification(event: OperatorEvent): CodeSuggestion | null {
  const rule = rules.find(({ pattern }) => pattern.test(event.rawMessage))
  if (!rule) return null
  const { pattern: _pattern, ...suggestion } = rule
  return { ...suggestion, code: event.rawCode }
}
