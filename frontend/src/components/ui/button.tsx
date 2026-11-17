import * as React from "react"
import { Button as SdkButton } from "@ui-sdk/react/button"

type Tone = "primary" | "secondary" | "danger"

function Button({
  tone = "secondary",
  round,
  size,
  ...props
}: React.ComponentProps<typeof SdkButton> & { tone?: Tone; round?: boolean; size?: "sm" | "lg" }) {
  return (
    <SdkButton
      data-kit="button"
      data-tone={tone}
      data-shape={round ? "round" : undefined}
      data-size={size}
      {...props}
    />
  )
}

export { Button }
