import * as React from "react"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

function Badge({ tone = "neutral", ...props }: React.ComponentProps<"span"> & { tone?: Tone }) {
  return <span data-kit="badge" data-tone={tone} {...props} />
}

export { Badge }
