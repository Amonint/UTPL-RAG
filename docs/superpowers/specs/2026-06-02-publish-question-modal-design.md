# Publish Question Modal - Design Spec

**Date:** 2026-06-02  
**Status:** Approved  

## Overview

Asesores (advisors) can publish frequently-asked questions directly from the main page. Questions are submitted for admin review before appearing in knowledge base.

## UI Components

### PublishQuestionButton
- Location: Top-right of page, below navbar (after "Correo" / "Calendario académico")
- Label: "Publicar pregunta"
- Opens PublishQuestionModal on click

### PublishQuestionModal
- Modal wrapper (style: ServiceDetailModal from campus360-hub)
- Form with required fields:
  1. **Dominio** (Domain) - dropdown, loaded from DB
  2. **Categoría** (Category) - dropdown, filtered by selected Domain
  3. **Subcategoría** (Subcategory) - dropdown, filtered by selected Category
  4. **Título de la pregunta** (Question Title) - text input, min 10 chars
  5. **Cuerpo de la pregunta** (Question Body) - textarea, min 20 chars
  6. **Respuesta** (Answer) - textarea, min 20 chars
- Buttons: "Publicar" (primary), "Cancelar" (secondary)
- Hidden field: Responsable (not shown, set to NULL)

## Data Flow

### Create Question (POST /api/questions/publish)

**Request Body:**
```json
{
  "domainId": "uuid",
  "categoryId": "uuid",
  "subcategoryId": "uuid",
  "title": "string",
  "questionBody": "string",
  "answer": "string"
}
```

**Response (success):**
```json
{
  "success": true,
  "knowledgeItemId": "uuid",
  "message": "Pregunta publicada exitosamente"
}
```

**Backend Logic:**
1. Validate all fields (non-empty, length constraints)
2. Create `knowledge_item` record:
   - `kb_element_id`: from subcategory
   - `domain_id`: from request
   - `section_code`: 'faq'
   - `canonical_slug`: auto-generated from title
   - `editorial_status`: 'review' (default)
   - `ingestion_status`: 'processed'
3. Create `knowledge_item_version` record:
   - `version_number`: 1
   - `question_text`: from request.questionBody
   - `answer_text`: from request.answer
   - `changed_by_responsible_id`: NULL
4. Return success response

### Admin Review

Questions appear in existing admin panel (`/admin/items`) filtered by `editorial_status='review'`. Admin can:
- Approve (→ 'approved' status)
- Request changes (→ 'editorial_draft' status)
- Reject (→ rejected)

## Validation Rules

| Field | Required | Min Length | Validation |
|-------|----------|-----------|------------|
| Dominio | Yes | - | Must be valid uuid from domains table |
| Categoría | Yes | - | Must be valid uuid, filtered by domain |
| Subcategoría | Yes | - | Must be valid uuid, filtered by category |
| Título | Yes | 10 | Non-empty, trimmed |
| Cuerpo | Yes | 20 | Non-empty, trimmed |
| Respuesta | Yes | 20 | Non-empty, trimmed |

## Error Handling

- Validation errors: Show inline field errors
- Network errors: "Error al publicar pregunta. Intenta nuevamente."
- Duplicate questions: Backend should handle (canonical_slug uniqueness)

## Success Flow

1. All validations pass
2. POST request succeeds
3. Modal shows toast: "¡Pregunta publicada! Está en revisión." (with success icon)
4. Modal closes after 2 seconds
5. Form resets for next submission

## Implementation Notes

- Use existing dropdown loading from taxonomy/categories (already in RagWorkbench)
- Reuse ValidationError components from AdminItemEditor if available
- Modal styling: match ServiceDetailModal structure
- API route: `/api/questions/publish` (new endpoint)
- Hook: `usePublishQuestion` (manages form state + API call)

## Dropdown Filtering Logic

1. **Dominio:** Load all active domains from DB
2. **Categoría:** On domain select, load all kb_categories where domain_id matches
3. **Subcategoría:** On category select, load all kb_subcategories where kb_category_id matches

## Canonical Slug Generation

Backend generates from title:
- Convert to lowercase
- Replace spaces/special chars with hyphens
- Remove accents (é→e, ñ→n)
- Append timestamp or counter if duplicate
- Format: `title-slug-1234567890`
- Ensure uniqueness with kb_element_id + canonical_slug constraint

## Scope

- No user authentication required (anyone can submit)
- No file attachments initially
- No search_forms_json, phrases_json, synonyms_json (can add later)
- No attachment support

## Database

No schema changes needed. Uses existing tables:
- `knowledge_items`
- `knowledge_item_versions`
- `kb_elements`, `kb_categories`, `kb_subcategories`
- `domains`
