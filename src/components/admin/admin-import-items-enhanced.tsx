'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react'
import type { OcrExtractionResult, OcrExtractionItem } from '@/lib/ocr/gemini-pdf-ocr'
import { extractPdfContent } from '@/lib/ocr/gemini-pdf-ocr'

interface ImportItem extends OcrExtractionItem {
  _index: number
}

interface AdminImportItemsEnhancedProps {
  sectionType: 'faq' | 'information' | 'calendar'
  onImportComplete?: (items: OcrExtractionItem[]) => void
  disabled?: boolean
}

export function AdminImportItemsEnhanced({
  sectionType,
  onImportComplete,
  disabled = false,
}: AdminImportItemsEnhancedProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null)
  const [items, setItems] = useState<ImportItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setLoading(true)
    setFileName(file.name)

    try {
      // Crear data URL del PDF para visor
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (typeof result === 'string') {
          setPdfDataUrl(result)
        }
      }
      reader.readAsDataURL(file)

      // Extraer contenido
      const result = await extractPdfContent(file, { sectionType })

      if (!result.success || result.items.length === 0) {
        setError(result.error || 'No se pudo extraer contenido del PDF')
        setLoading(false)
        return
      }

      const itemsWithIndex = result.items.map((item, idx) => ({
        ...item,
        _index: idx,
      }))

      setItems(itemsWithIndex)
      setSelectedIndex(0)
      setLoading(false)

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setLoading(false)
    }
  }

  const updateItem = (index: number, field: keyof OcrExtractionItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    )
  }

  const selectedItem = items[selectedIndex] || null

  if (items.length === 0 && !error) {
    return (
      <div className="space-y-3 rounded-lg border border-chalk bg-granite-50 p-4">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-slate" />
          <label className="font-medium text-sm text-obsidian">Cargar documento PDF</label>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          disabled={loading || disabled}
          className="hidden"
          aria-label="Upload PDF"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || disabled}
          className="w-full"
        >
          {loading ? 'Procesando...' : 'Seleccionar PDF'}
        </Button>

        {fileName && (
          <p className="text-xs text-slate">
            {fileName}
          </p>
        )}

        {error && (
          <div className="flex gap-2 rounded-md bg-red-50 p-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
            <p className="text-xs text-red-800">{error}</p>
          </div>
        )}
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-chalk bg-red-50 p-4">
        <div className="flex gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
          <div>
            <p className="text-xs font-medium text-red-800">Error al procesar PDF</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null)
            setItems([])
            setPdfDataUrl(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        >
          Intentar de nuevo
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <p className="text-sm font-medium text-obsidian">
          {items.length} item{items.length !== 1 ? 's' : ''} extraído{items.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-chalk bg-white p-4 lg:grid-cols-[200px_1fr_350px] min-h-[500px]">
        {/* Lista de items */}
        <div className="flex flex-col gap-2 border-r border-chalk pr-3 max-h-[500px] overflow-y-auto">
          <p className="text-xs font-medium text-gravel mb-2">Items extraídos</p>
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`text-left p-2 rounded text-xs transition ${
                selectedIndex === idx
                  ? 'bg-blue-100 border border-blue-300 text-obsidian'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="font-medium truncate">{item.title || `Item ${idx + 1}`}</div>
              {item.topic && <div className="text-gravel text-xs truncate">{item.topic}</div>}
            </button>
          ))}
        </div>

        {/* Editor */}
        {selectedItem && (
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px]">
            <div>
              <label className="mb-1 block text-xs font-medium text-gravel">Título</label>
              <Input
                value={selectedItem.title || ''}
                onChange={(e) => updateItem(selectedIndex, 'title', e.target.value)}
                className="text-sm"
              />
            </div>

            {sectionType === 'calendar' ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gravel">Tema/Categoría</label>
                  <Input
                    value={selectedItem.topic || ''}
                    onChange={(e) => updateItem(selectedIndex, 'topic', e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gravel">Fecha inicio (YYYY-MM-DD)</label>
                  <Input
                    value={selectedItem.startDate || ''}
                    onChange={(e) => updateItem(selectedIndex, 'startDate', e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gravel">Fecha fin (YYYY-MM-DD)</label>
                  <Input
                    value={selectedItem.endDate || ''}
                    onChange={(e) => updateItem(selectedIndex, 'endDate', e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gravel">Descripción (fechas exactas)</label>
                  <textarea
                    value={selectedItem.description || ''}
                    onChange={(e) => updateItem(selectedIndex, 'description', e.target.value)}
                    rows={4}
                    className="text-xs w-full rounded border border-chalk px-2 py-1"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gravel">Pregunta</label>
                  <textarea
                    value={selectedItem.question || ''}
                    onChange={(e) => updateItem(selectedIndex, 'question', e.target.value)}
                    rows={3}
                    className="text-xs w-full rounded border border-chalk px-2 py-1"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gravel">Respuesta</label>
                  <textarea
                    value={selectedItem.answer || ''}
                    onChange={(e) => updateItem(selectedIndex, 'answer', e.target.value)}
                    rows={4}
                    className="text-xs w-full rounded border border-chalk px-2 py-1"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Visor PDF */}
        {pdfDataUrl && (
          <div className="border-l border-chalk pl-3 flex flex-col">
            <p className="text-xs font-medium text-gravel mb-2">Documento original</p>
            <iframe
              src={pdfDataUrl}
              className="flex-1 rounded border border-chalk"
              title="PDF Viewer"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null)
            setItems([])
            setPdfDataUrl(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        >
          Cargar otro PDF
        </Button>
        {onImportComplete && (
          <Button
            type="button"
            onClick={() => onImportComplete(items)}
            className="ml-auto"
          >
            Continuar con estos items
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
