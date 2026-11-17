import * as React from "react"
import { Separator as SdkSeparator } from "@ui-sdk/react/separator"

function Separator(props: React.ComponentProps<typeof SdkSeparator>) {
  return <SdkSeparator data-kit="separator" {...props} />
}

export { Separator }
