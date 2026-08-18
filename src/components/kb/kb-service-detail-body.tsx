'use client'

import { FileText } from 'lucide-react'

import {
  collectPayloadLinkUrls,
  payloadForDisplay,
  ServicePayloadProse,
} from '@/components/service-payload-prose'
import { AudienceBadges } from '@/components/kb/audience-badges'
import { contentTypeLabel } from '@/lib/kb/content-labels'
import { documentationDetailTitle } from '@/lib/kb/audience-labels'
import { sanitizePublicAnswerText } from '@/lib/kb/sanitize-public-answer'
import type { PdfRef } from '@/lib/types'

export type KbServiceDetailItem = {
  serviceId: string
  serviceName: string
  category: string
  jsonPayload: Record<string, unknown>
  studentTypes?: string[]
  pdfRefs?: PdfRef[]
  referenceUrl?: string | null
  uiSection?: 'documentation' | 'services_incidents'
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function KbServiceDetailBody({ item }: { item: KbServiceDetailItem }) {
  const payload = item.jsonPayload ?? {}
  const displayPayload = payloadForDisplay(payload)
  const types = item.studentTypes ?? []
  const pdfs: PdfRef[] = item.pdfRefs ?? []
  const inlinedUrls = collectPayloadLinkUrls(payload)

  const sectionCode =
    item.uiSection === 'documentation'
      ? 'general_info'
      : readText(payload.section_code) || 'faq'
  const elementName = readText(payload.element)
  const displayTitle = documentationDetailTitle({
    sectionCode,
    elementName,
    serviceName: item.serviceName,
  })

  const categoryLabel =
    readText(payload.category) || readText(payload.subcategory) || item.category
  const questionText = readText(payload.question)
  const answerText = sanitizePublicAnswerText(readText(payload.answer))
  const showQuestionSubtitle =
    questionText.length > 0 &&
    questionText.toLowerCase() !== displayTitle.trim().toLowerCase()

  const prose = <ServicePayloadProse payload={displayPayload} />

  const extraPdfs = pdfs.filter((ref) => {
    const href = ref.url?.trim()
    if (!href) return false
    return !inlinedUrls.has(href)
  })

  const hasExtraProse = Object.keys(displayPayload).some((k) => {
    const v = displayPayload[k]
    if (v === null || v === undefined) return false
    if (typeof v === 'string' && v.trim() === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  })

  return (
    <article className="grid gap-4">
      <header className="grid gap-1 border-b border-chalk pb-4">
        <p className="m-0 text-xs uppercase tracking-[0.06em] text-gravel">
          {contentTypeLabel(payload.content_type, sectionCode)}
          {categoryLabel ? ` · ${categoryLabel}` : ''}
        </p>
        <h2 className="m-0 text-xl text-obsidian">{displayTitle}</h2>
        <AudienceBadges payload={payload} studentTypes={types} />
        {showQuestionSubtitle ? (
          <p className="m-0 text-sm leading-relaxed text-cinder">{questionText}</p>
        ) : null}
      </header>

      {answerText ? (
        <div className="whitespace-pre-wrap text-[15px] leading-7 text-obsidian">{answerText}</div>
      ) : null}

      {hasExtraProse ? <div className="text-[15px] leading-7 text-obsidian">{prose}</div> : null}

      {extraPdfs.length > 0 ? (
        <div className="grid gap-2 text-[15px] leading-7 text-obsidian">
          <p className="m-0">
            <strong>Documentos PDF</strong>
          </p>
          <ul className="m-0 list-none space-y-2 p-0">
            {extraPdfs.map((ref) => {
              const href = ref.url?.trim()
              if (!href) return null
              return (
                <li key={`${ref.url}-${ref.label ?? 'pdf'}`}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    <FileText className="size-4 shrink-0 opacity-80" aria-hidden />
                    {ref.label?.trim() || 'Abrir PDF'}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {item.referenceUrl ? (
        <div className="grid gap-2 text-[15px] leading-7 text-obsidian">
          <p className="m-0">
            <strong>Más información</strong>
          </p>
          <a
            href={item.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-2 hover:text-primary/90"
          >
            Ver enlace
          </a>
        </div>
      ) : null}
    </article>
  )
}
