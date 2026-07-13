import { Loader2 } from 'lucide-react'

export function Spinner({ size = 20 }: { size?: number; color?: string }) {
  return <Loader2 className="animate-spin text-gravel" style={{ width: size, height: size }} />
}
