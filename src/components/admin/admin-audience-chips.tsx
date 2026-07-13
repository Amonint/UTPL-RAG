import type { AudienceSummary } from '@/lib/admin/ui-labels'
import { audienceChipLabels } from '@/lib/admin/ui-labels'
import { cn } from '@/lib/utils'

export function AdminAudienceChips({
  audiences,
  className,
}: {
  audiences: AudienceSummary[]
  className?: string
}) {
  const labels = audienceChipLabels(audiences)

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex max-w-full truncate rounded-full bg-eggshell px-2 py-0.5 text-[11px] text-cinder"
          title={label}
        >
          {label}
        </span>
      ))}
    </div>
  )
}
