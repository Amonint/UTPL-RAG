'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, AlertCircle, CheckCircle, Loader } from 'lucide-react'

interface CreatedEvent {
  id: string
  title: string
  startsOn: string | null
  endsOn: string | null
}

interface ImportResult {
  processedBlocks?: number
  createdCount?: number
  skippedCount?: number
  created?: CreatedEvent[]
  warnings?: Array<{ index: number; reason: string }>
  error?: string
  success?: boolean
}

interface AdminCalendarImportProps {
  onImported: (result: ImportResult) => void
  disabled?: boolean
}

export function AdminCalendarImport({ onImported, disabled = false }: AdminCalendarImportProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
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

      const res = await fetch('/api/admin/calendar-events/import-document', {
        method: 'POST',
        body: formData,
      })

      const importResult = (await res.json()) as ImportResult

      if (!res.ok) {
        setError(importResult.error || 'No se pudo cargar el documento. Intente de nuevo.')
        setLoading(false)
        return
      }

      setSuccess(true)
      setResult(importResult)
      onImported(importResult)
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
        <label className="font-medium text-sm text-obsidian">Cargar eventos desde PDF</label>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        disabled={loading || disabled}
        className="hidden"
        aria-label="Subir calendario en PDF"
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

      {success && result && (
        <div className="flex flex-col gap-2 rounded-md bg-green-50 p-3">
          <div className="flex gap-2">
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
            <p className="text-xs text-green-800">
              {result.createdCount ?? 0} evento{result.createdCount !== 1 ? 's' : ''} creado
              {result.createdCount !== 1 ? 's' : ''} exitosamente.
            </p>
          </div>
          {(result.createdCount ?? 0) > 0 && result.created && result.created.length > 0 && (
            <ul className="ml-6 text-xs text-green-800 space-y-1">
              {result.created.map((event) => (
                <li key={event.id}>
                  • {event.title}
                  {event.startsOn && ` (${event.startsOn})`}
                </li>
              ))}
            </ul>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <div className="mt-2 border-t border-green-200 pt-2">
              <p className="text-xs font-medium text-amber-800">
                {result.warnings.length} evento{result.warnings.length !== 1 ? 's' : ''} con advertencia
                {result.warnings.length !== 1 ? 's' : ''}:
              </p>
              <ul className="ml-6 text-xs text-amber-800 space-y-1">
                {result.warnings.map((w) => (
                  <li key={w.index}>• Evento {w.index + 1}: {w.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
