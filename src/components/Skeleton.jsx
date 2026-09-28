export function CardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-[4/3] w-full animate-pulse bg-warm/10" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-warm/10" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-warm/10" />
      </div>
    </div>
  )
}

export function GridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function RowSkeleton({ avatar = true, action = true }) {
  return (
    <div className="card flex items-center gap-3 p-3">
      {avatar && <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-warm/10" />}
      <span className="h-4 flex-1 animate-pulse rounded bg-warm/10" />
      {action && <span className="h-8 w-16 shrink-0 animate-pulse rounded-xl bg-warm/10" />}
    </div>
  )
}

export function ListSkeleton({ count = 3, avatar = true, action = true }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <RowSkeleton key={i} avatar={avatar} action={action} />
      ))}
    </div>
  )
}

export function ChecklistSkeleton({ count = 4 }) {
  return (
    <ul className="card divide-y divide-warm/5 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 p-3">
          <span className="h-6 w-6 shrink-0 animate-pulse rounded-md bg-warm/10" />
          <span className="h-4 flex-1 animate-pulse rounded bg-warm/10" />
        </li>
      ))}
    </ul>
  )
}

export function StatSkeleton() {
  return (
    <div className="card flex flex-col items-center py-4">
      <span className="h-7 w-10 animate-pulse rounded bg-warm/10" />
      <span className="mt-2 h-3 w-14 animate-pulse rounded bg-warm/10" />
    </div>
  )
}

export function RecipeDetailSkeleton() {
  return (
    <div className="animate-fadein">
      <div className="relative -mx-4 -mt-5 mb-4 h-56 animate-pulse overflow-hidden bg-warm/10 sm:-mx-8 sm:rounded-b-3xl" />
      <div className="mb-4 space-y-2">
        <div className="h-4 w-20 animate-pulse rounded-full bg-warm/10" />
        <div className="h-7 w-3/4 animate-pulse rounded bg-warm/10" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-warm/10" />
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
      <ChecklistSkeleton count={5} />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-warm/10" />
        ))}
      </div>
    </div>
  )
}
