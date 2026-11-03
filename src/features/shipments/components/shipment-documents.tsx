import { ExternalLink, FileText } from 'lucide-react'
import type { ShipmentDocument } from '@/domain/contracts'
import { Badge } from '@/shared/ui/badge'
import { formatTime } from '@/shared/lib/format'
import { documentKindLabels } from '../lib/presentation'

export function DocumentLink({ document }: { document: ShipmentDocument }) {
  if (document.state !== 'available' || !document.resourcePath) return null
  return (
    <a
      className="document-open"
      href={document.resourcePath}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir ${document.name} en una pestaña nueva`}
    >
      Abrir
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  )
}

export function ShipmentDocuments({ documents }: { documents: readonly ShipmentDocument[] }) {
  if (!documents.length) return null
  return (
    <section className="detail-panel documents-panel" aria-labelledby="documents-title">
      <div className="detail-panel-heading">
        <h3 id="documents-title">
          <FileText size={18} aria-hidden="true" />
          Documentos
        </h3>
      </div>
      <ul className="document-list">
        {documents.map((document) => {
          const available = document.state === 'available'
          return (
            <li
              key={document.id}
              id={`document-${document.id}`}
              tabIndex={-1}
              className="document-item"
              data-state={document.state}
            >
              <div className="document-name">
                <strong>{document.name}</strong>
                <span>
                  {documentKindLabels[document.kind]}
                  {available && document.uploadedAt && ` · ${formatTime(document.uploadedAt)}`}
                </span>
              </div>
              <Badge
                variant="secondary"
                className={available ? 'status-delivered' : 'status-missing'}
              >
                {available ? 'Disponible' : 'Pendiente de recibir'}
              </Badge>
              <DocumentLink document={document} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
