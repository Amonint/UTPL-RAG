import {
  fetchEditorialStatuses,
  fetchCyclePeriods,
  fetchProfileTypes,
  fetchStudentTypes,
} from '@/lib/db/admin/catalog-repository'
import { fetchAdminTaxonomyTree } from '@/lib/db/admin/taxonomy-repository'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  createItemSchema,
  importDocumentInputSchema,
  geminiImportBlockSchema,
} from '@/lib/admin/validation'
import { classifyDocumentWithGemini } from '@/lib/admin/document-import/gemini-import-service'
import { extractPdfTextFromBuffer } from '@/lib/ingest/pdf-text'
import { createKnowledgeItem } from '@/lib/db/admin/knowledge-item-repository'
import { withDbTransaction } from '@/lib/db/transaction'
import type { z } from 'zod'

type GeminiBlock = z.infer<typeof geminiImportBlockSchema>

type ImportWarning = {
  index: number
  reason: string
}

type CreatedRow = {
  id: string
  sectionCode: 'faq' | 'general_info'
  title: string
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return Response.json({ error: 'Debe seleccionar un archivo PDF.' }, { status: 400 })
    }

    importDocumentInputSchema.parse({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    })

    const [taxonomyTree, profileTypes, studentTypes, cyclePeriods, editorialStatuses] = await Promise.all([
      fetchAdminTaxonomyTree(),
      fetchProfileTypes(),
      fetchStudentTypes(),
      fetchCyclePeriods(true),
      fetchEditorialStatuses(true),
    ])

    const taxonomyOptions = taxonomyTree.flatMap((domain) =>
      domain.categories.flatMap((category) =>
        category.subcategories.flatMap((subcategory) =>
          subcategory.elements.map((element) => ({
            domainCode: domain.code,
            domainName: domain.name,
            categorySlug: category.slug,
            categoryName: category.name,
            subcategorySlug: subcategory.slug,
            subcategoryName: subcategory.name,
            elementSlug: element.slug,
            elementName: element.name,
          })),
        ),
      ),
    )

    const taxonomyByKey = new Map(
      taxonomyOptions.map((row) => [
        `${row.domainCode}|${row.categorySlug}|${row.subcategorySlug}|${row.elementSlug}`,
        row,
      ]),
    )
    const profileTypeSet = new Set(
      profileTypes.filter((row) => row.profileCode === 'student').map((row) => row.typeCode),
    )
    const studentTypeSet = new Set(studentTypes.map((row) => row.code))
    const cyclePeriodByCode = new Map(cyclePeriods.map((row) => [row.code, row]))
    const taxonomyKeyToIds = new Map<string, { domainId: string; elementId: string }>()
    for (const domain of taxonomyTree) {
      for (const category of domain.categories) {
        for (const subcategory of category.subcategories) {
          for (const element of subcategory.elements) {
            taxonomyKeyToIds.set(
              `${domain.code}|${category.slug}|${subcategory.slug}|${element.slug}`,
              { domainId: domain.id, elementId: element.id },
            )
          }
        }
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rawText = await extractPdfTextFromBuffer(buffer)
    const documentText = normalizeText(rawText)
    if (!documentText) {
      return Response.json({ error: 'No se pudo extraer texto utilizable del PDF.' }, { status: 400 })
    }

    const llmResult = await classifyDocumentWithGemini({
      documentText,
      catalogs: {
        taxonomy: taxonomyOptions,
        profileTypes: profileTypes
          .filter((row) => row.profileCode === 'student')
          .map((row) => ({ typeCode: row.typeCode, name: row.name })),
        studentTypes: studentTypes.map((row) => ({ code: row.code, name: row.name })),
        cyclePeriods: cyclePeriods.map((row) => ({ code: row.code, name: row.name })),
        editorialStatuses: editorialStatuses.map((row) => ({ code: row.code, name: row.name })),
      },
    })

    const warnings: ImportWarning[] = []
    const validBlocks: Array<{ index: number; block: GeminiBlock }> = []
    llmResult.blocks.forEach((block, idx) => {
      const blockIndex = idx + 1
      const taxonomyKey = `${block.taxonomy.domainCode}|${block.taxonomy.categorySlug}|${block.taxonomy.subcategorySlug}|${block.taxonomy.elementSlug}`
      if (!taxonomyByKey.has(taxonomyKey)) {
        warnings.push({
          index: blockIndex,
          reason: 'Taxonomía no válida según catálogos vigentes.',
        })
        return
      }
      if (block.audience?.profileTypeCode && !profileTypeSet.has(block.audience.profileTypeCode)) {
        warnings.push({
          index: blockIndex,
          reason: 'Modalidad no válida según catálogo vigente.',
        })
        return
      }
      if (block.audience?.studentTypeCode && !studentTypeSet.has(block.audience.studentTypeCode)) {
        warnings.push({
          index: blockIndex,
          reason: 'Tipo de estudiante no válido según catálogo vigente.',
        })
        return
      }
      if (block.sectionCode === 'general_info' && block.periodCode && !cyclePeriodByCode.has(block.periodCode)) {
        warnings.push({
          index: blockIndex,
          reason: 'Periodo académico no válido según catálogo vigente.',
        })
        return
      }
      validBlocks.push({ index: blockIndex, block })
    })

    const created: CreatedRow[] = []
    if (validBlocks.length > 0) {
      await withDbTransaction(async (client) => {
        for (const entry of validBlocks) {
          const block = entry.block
          const taxonomyKey = `${block.taxonomy.domainCode}|${block.taxonomy.categorySlug}|${block.taxonomy.subcategorySlug}|${block.taxonomy.elementSlug}`
          const taxonomyIds = taxonomyKeyToIds.get(taxonomyKey)
          if (!taxonomyIds) {
            warnings.push({ index: entry.index, reason: 'No se pudo mapear taxonomía a IDs internos.' })
            continue
          }
          const period = block.sectionCode === 'general_info' && block.periodCode
            ? cyclePeriodByCode.get(block.periodCode)
            : undefined
          const payload = createItemSchema.parse({
            kbElementId: taxonomyIds.elementId,
            domainId: taxonomyIds.domainId,
            sectionCode: block.sectionCode,
            contentType: block.sectionCode === 'faq' ? 'faq' : 'guide',
            title: block.title,
            questionText: block.sectionCode === 'faq' ? block.questionText : (block.subtitle ?? ''),
            answerText: block.answerText,
            periodLabel: period?.name,
            validFrom: block.sectionCode === 'general_info' ? (block.validFrom ?? null) : null,
            validTo: block.sectionCode === 'general_info' ? (block.validTo ?? null) : null,
            editorialStatus: 'review',
            audiences: [
              {
                profileCode: 'student',
                profileTypeCode: block.audience?.profileTypeCode ?? 'sin_tipo',
                studentTypeCode: block.audience?.studentTypeCode ?? null,
              },
            ],
          })
          const id = await createKnowledgeItem(client, payload)
          created.push({
            id,
            sectionCode: block.sectionCode,
            title: payload.title,
          })
        }
      })
    }

    return Response.json({
      processedBlocks: llmResult.blocks.length,
      createdCount: created.length,
      skippedCount: llmResult.blocks.length - created.length,
      created,
      warnings,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo importar el documento.'
    return Response.json({ error: message }, { status: 400 })
  }
}
