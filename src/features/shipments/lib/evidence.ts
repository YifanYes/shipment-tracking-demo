/** Move focus to an evidence item rendered in the same detail page. */
export function focusEvidence(targetId: string) {
  const element = document.getElementById(targetId)
  if (!element) return
  element.scrollIntoView?.({ block: 'center' })
  element.focus({ preventScroll: true })
}
