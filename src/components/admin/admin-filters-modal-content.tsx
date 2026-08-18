'use client'

import { AdminCatalogSettings } from '@/components/admin/admin-catalog-settings'
import styles from '@/components/admin/admin-filters-modal.module.css'

export function AdminFiltersModalContent() {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Administración interna</p>
        <h3 className={styles.title}>Administrar filtros</h3>
        <p className={styles.description}>
          Cree, edite o desactive los filtros del listado de información.
        </p>
      </header>
      <div className={styles.body}>
        <AdminCatalogSettings />
      </div>
    </div>
  )
}
