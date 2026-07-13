import { isAdminEnabled, adminDisabledResponse } from '@/lib/admin/config'

export function assertAdminEnabled(): Response | null {
  if (!isAdminEnabled()) return adminDisabledResponse()
  if (!process.env.DATABASE_URL?.trim()) {
    return Response.json({ error: 'DATABASE_URL is required' }, { status: 503 })
  }
  return null
}
