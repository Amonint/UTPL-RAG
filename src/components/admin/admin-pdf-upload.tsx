'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import type { OcrExtractionResult } from '@/lib/ocr/gemini-pdf-ocr'

interface AdminPdfUploadProps {
  sectionType: 'faq' | 'information' | 'calendar'
  onExtracted: (result: OcrExtractionResult) => void
  disabled?: boolean
}

export function AdminPdfUpload({ sectionType, onExtracted, disabled = false }: AdminPdfUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccess(false)
    setLoading(true)
    setFileName(file.name)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sectionType', sectionType)

      const res = await fetch('/api/admin/ocr', {
        method: 'POST',
        body: formData,
      })

      const result = (await res.json()) as OcrExtractionResult

      if (!res.ok || !result.success || result.items.length === 0) {
        setError(result.error || 'No se pudo leer el documento. Verifique que sea un PDF válido e intente de nuevo.')
        setLoading(false)
        return
      }

      setSuccess(true)
      onExtracted(result)
      setLoading(false)

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado. Intente de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-chalk bg-granite-50 p-4">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-slate" />
        <label className="font-medium text-sm text-obsidian">Cargar desde documento</label>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        disabled={loading || disabled}
        className="hidden"
        aria-label="Subir documento PDF"
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || disabled}
          className="w-full"
        >
          {loading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {loading ? 'Procesando…' : 'Seleccionar PDF'}
        </Button>
      </div>

      {fileName && (
        <p className="text-xs text-slate">
          {success ? '✓ ' : ''} {fileName}
        </p>
      )}

      {error && (
        <div className="flex gap-2 rounded-md bg-red-50 p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex gap-2 rounded-md bg-green-50 p-3">
          <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
          <p className="text-xs text-green-800">Contenido extraído. Revise y edite abajo.</p>
        </div>
      )}
    </div>
  )
}
