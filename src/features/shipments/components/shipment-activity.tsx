import { BellRing, History } from 'lucide-react'
import type { ActivityRecord, ShipmentView } from '@/domain/contracts'
import { notificationsOf } from '@/domain/actions'
import { formatTime } from '@/shared/lib/format'
import type { Audience } from '../lib/presentation'

const actionLabels: Record<ActivityRecord['action'], string> = {
  notify_customer: 'Aviso al cliente',
  contact_operator: 'Solicitud al operador',
  provide_document: 'Documento aportado',
  classify_event: 'Código clasificado',
}

/** Operations see the activity log; customers see only the notices addressed to them. */
export function ShipmentActivity({
  view,
  audience,
  actorName,
}: {
  view: ShipmentView
  audience: Audience
  actorName: (identityId: string) => string
}) {
  if (audience === 'customer') {
    const notices = notificationsOf([view])
    if (!notices.length) return null
    return (
      <section className="detail-panel activity-panel" aria-labelledby="notices-title">
        <div className="detail-panel-heading">
          <h3 id="notices-title">
            <BellRing size={18} aria-hidden="true" />
            Avisos
          </h3>
        </div>
        <ul className="activity-list">
          {notices.map((notice) => (
            <li key={notice.id}>
              <time dateTime={notice.createdAt}>{formatTime(notice.createdAt)}</time>
              <strong>{notice.title}</strong>
              <p>{notice.message}</p>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  if (!view.activity.length) return null
  const records = [...view.activity].sort(
    (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.id.localeCompare(a.id),
  )
  return (
    <section className="detail-panel activity-panel" aria-labelledby="activity-title">
      <div className="detail-panel-heading">
        <h3 id="activity-title">
          <History size={18} aria-hidden="true" />
          Actividad
        </h3>
      </div>
      <ul className="activity-list">
        {records.map((record) => (
          <li key={record.id}>
            <time dateTime={record.recordedAt}>
              {formatTime(record.recordedAt)} · {actorName(record.actorIdentityId)}
            </time>
            <strong>
              {actionLabels[record.action]}
              {record.action !== 'provide_document' && ` · ${record.recipient}`}
            </strong>
            <p>{record.action === 'provide_document' ? record.subject : record.message}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
