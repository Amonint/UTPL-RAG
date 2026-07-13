export function isAdminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === 'true'
}

export function adminDisabledResponse() {
  return Response.json({ error: 'Admin panel is disabled' }, { status: 404 })
}
