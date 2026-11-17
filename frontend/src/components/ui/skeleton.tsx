import * as React from "react"

// With `lines`, the kit's placeholder: a round block and that many bars.
// Without, one block shaped by its caller.
function Skeleton({ lines, ...props }: React.ComponentProps<"span"> & { lines?: number }) {
  if (lines === undefined) return <span data-kit="skeleton-block" aria-hidden {...props} />
  return (
    <div data-kit="skeleton" aria-busy="true" aria-label="Loading">
      <span data-kit="skeleton-block" data-shape="circle" />
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} data-kit="skeleton-block" style={{ width: `${90 - index * 18}%` }} />
      ))}
    </div>
  )
}

export { Skeleton }
