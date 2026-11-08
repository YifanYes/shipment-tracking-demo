import { useRef, useState } from 'react'
import { FilePlus2, Mail, MessageSquareShare } from 'lucide-react'
import type { RecommendedAction } from '@/domain/contracts'
import { AiBadge } from '@/shared/ui/ai-badge'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { toastManager } from '@/shared/ui/toast'

export type RecordAction = (actionId: string, message?: string) => void

const confirmLabels: Record<RecommendedAction['kind'], string> = {
  notify_customer: 'Registrar aviso',
  contact_operator: 'Registrar solicitud',
  provide_document: 'Aportar documento',
  classify_event: 'Aceptar propuesta',
}

const resultTitles: Record<RecommendedAction['kind'], string> = {
  notify_customer: 'Aviso registrado',
  contact_operator: 'Solicitud registrada',
  provide_document: 'Documento aportado',
  classify_event: 'Código clasificado',
}

/** The button of a recorded action disappears: focus continues at the incidents heading. */
const incidentsHeading = () =>
  document.getElementById('incidents-title') ?? document.getElementById('risk-title')

export function IncidentActions({
  actions,
  onRecord,
}: {
  actions: readonly RecommendedAction[]
  onRecord: RecordAction
}) {
  if (!actions.length) return null
  const record = (action: RecommendedAction, message?: string) => {
    onRecord(action.id, message)
    toastManager.add({
      title: resultTitles[action.kind],
      description: action.kind === 'provide_document' ? action.subject : `Para ${action.recipient}`,
      timeout: 5000,
    })
  }
  return (
    <ul className="incident-actions" aria-label="Acciones recomendadas">
      {actions.map((action) => (
        <li key={action.id} className="incident-action" data-priority={action.priority}>
          <div>
            <strong>
              {action.title}
              {action.priority === 'urgent' && (
                <Badge variant="secondary" className="status-missing">
                  Urgente
                </Badge>
              )}
            </strong>
            <p>{action.explanation}</p>
          </div>
          {action.kind === 'provide_document' ? (
            <Button
              size="sm"
              onClick={() => {
                record(action)
                incidentsHeading()?.focus()
              }}
            >
              <FilePlus2 aria-hidden="true" />
              {confirmLabels[action.kind]}
            </Button>
          ) : (
            <MessageDialog action={action} onConfirm={(message) => record(action, message)} />
          )}
        </li>
      ))}
    </ul>
  )
}

function MessageDialog({
  action,
  onConfirm,
}: {
  action: RecommendedAction
  onConfirm: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState(action.message)
  const confirmed = useRef(false)
  const Icon = action.kind === 'notify_customer' ? Mail : MessageSquareShare
  const fieldId = `${action.id}-message`
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setMessage(action.message)
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon aria-hidden="true" />
        {action.kind === 'notify_customer' ? 'Preparar aviso' : 'Preparar solicitud'}
      </Button>
      <DialogContent
        className="sm:max-w-md"
        finalFocus={() => (confirmed.current ? incidentsHeading() : true)}
      >
        <form
          className="action-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!message.trim()) return
            confirmed.current = true
            onConfirm(message)
            setOpen(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>{action.title}</DialogTitle>
            <DialogDescription className="action-recipient">
              Para: {action.recipient}
              <AiBadge label="Borrador IA" />
            </DialogDescription>
          </DialogHeader>
          <p className="action-subject">{action.subject}</p>
          <label htmlFor={fieldId}>Mensaje</label>
          <textarea
            id={fieldId}
            value={message}
            rows={5}
            onChange={(event) => setMessage(event.target.value)}
          />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={!message.trim()}>
              {confirmLabels[action.kind]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
