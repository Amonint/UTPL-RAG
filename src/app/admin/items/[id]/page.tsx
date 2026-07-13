import { AdminItemEditor } from '@/components/admin/admin-item-editor'

export default async function AdminEditItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AdminItemEditor itemId={id} />
}
