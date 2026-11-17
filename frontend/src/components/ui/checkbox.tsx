import * as React from "react"
import { Icon } from "@/components/ui/icon"
import { Checkbox as SdkCheckbox, CheckboxIndicator } from "@ui-sdk/react/checkbox"

// With an icon the latching key shows the icon on its cap and the label only
// names it for screen readers. The kit sizes a bare key by its printed label,
// so `hideLabel` falls back to a check icon.
function Checkbox({
  label,
  icon,
  hideLabel,
  checked,
  defaultChecked,
  disabled,
  onCheckedChange,
}: {
  label: string
  icon?: React.ComponentProps<typeof Icon>["name"]
  hideLabel?: boolean
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  const glyph = icon ?? (hideLabel ? "check" : undefined)
  return (
    <label data-kit="check" data-icon={glyph ? "" : undefined}>
      <SdkCheckbox
        data-kit="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onCheckedChange={onCheckedChange && ((next) => onCheckedChange(next === true))}
      >
        <CheckboxIndicator data-kit="checkbox-indicator" keepMounted />
        {glyph && (
          <span data-kit="check-icon" aria-hidden>
            <Icon name={glyph} />
          </span>
        )}
      </SdkCheckbox>
      <span data-kit={glyph ? "visually-hidden" : "label"}>{label}</span>
    </label>
  )
}

export { Checkbox }
