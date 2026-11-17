import * as React from "react"
import { ScrollArea as SdkScrollArea, ScrollAreaContent, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@ui-sdk/react/scroll-area"

function ScrollArea({
  label,
  children,
  ...props
}: React.ComponentProps<typeof SdkScrollArea> & { label?: string }) {
  return (
    <SdkScrollArea data-kit="scroll-area" {...props}>
      <ScrollAreaViewport data-kit="scroll-area-viewport" role={label ? "region" : undefined} aria-label={label}>
        <ScrollAreaContent data-kit="scroll-area-content">{children}</ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar data-kit="scroll-area-scrollbar">
        <ScrollAreaThumb data-kit="scroll-area-thumb" />
      </ScrollAreaScrollbar>
    </SdkScrollArea>
  )
}

export { ScrollArea }
