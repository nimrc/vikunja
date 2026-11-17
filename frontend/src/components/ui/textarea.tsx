import * as React from "react"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { Textarea as SdkTextarea } from "@ui-sdk/react/textarea"

function Textarea({ label, ...props }: React.ComponentProps<typeof SdkTextarea> & { label?: string }) {
  const area = <SdkTextarea data-kit="input" data-multiline="" {...props} />
  if (!label) return area
  return (
    <Field data-kit="field">
      <FieldLabel data-kit="label">{label}</FieldLabel>
      {area}
    </Field>
  )
}

export { Textarea }
