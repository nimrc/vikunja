import { Field, FieldLabel } from "@ui-sdk/react/field"
import { Radio, RadioGroup as SdkRadioGroup, RadioIndicator } from "@ui-sdk/react/radio"

type Option = string | { value: string; label: string }

function RadioGroup({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
}: {
  label: string
  options: Option[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <Field data-kit="field">
      <FieldLabel data-kit="label">{label}</FieldLabel>
      <SdkRadioGroup
        data-kit="radio-group"
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange && ((next) => next && onValueChange(String(next)))}
      >
        {options.map((option) => {
          const { value: optionValue, label: optionLabel } =
            typeof option === "string" ? { value: option, label: option } : option
          return (
            <label key={optionValue} data-kit="check" data-value={optionValue}>
              <Radio value={optionValue} data-kit="radio">
                <RadioIndicator data-kit="radio-indicator" keepMounted />
              </Radio>
              <span data-kit="label">{optionLabel}</span>
            </label>
          )
        })}
      </SdkRadioGroup>
    </Field>
  )
}

export { RadioGroup }
