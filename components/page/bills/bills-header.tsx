import { Plus } from 'lucide-react'

interface BillsHeaderProps {
  onCreate: () => void
}

export function BillsHeader({ onCreate }: BillsHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What is coming up</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Bills & Income</h1>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-ios hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        New Entry
      </button>
    </div>
  )
}
