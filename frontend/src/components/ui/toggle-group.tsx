import * as React from "react"
import { Toggle, ToggleGroup as SdkToggleGroup } from "@ui-sdk/react/toggle"

// One choice from a row of latching keys. An option with an icon shows only
// the icon, its label naming it for screen readers.
function ToggleGroup({
  label,
  options,
  value,
  onValueChange,
}: {
  label: string
  options: { value: string; label: string; icon?: React.ReactNode }[]
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <SdkToggleGroup
      data-kit="toolbar"
      aria-label={label}
      value={[value]}
      onValueChange={(next) => next[0] && onValueChange(next[0])}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          data-kit="toggle"
          aria-label={option.icon ? option.label : undefined}
        >
          {option.icon ?? option.label}
        </Toggle>
      ))}
    </SdkToggleGroup>
  )
}

export { ToggleGroup }
