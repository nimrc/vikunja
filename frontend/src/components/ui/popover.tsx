import * as React from "react"
import {
  Popover,
  PopoverClose,
  PopoverContent as SdkPopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover"

// The kit's popover, in parts. Its trigger is unstyled: give it a `render`,
// like a Button, or style it where it's used.
function PopoverContent({
  children,
  side = "bottom",
  align = "center",
  sideOffset = 12,
  ...props
}: Omit<React.ComponentProps<typeof SdkPopoverContent>, "children"> & { children?: React.ReactNode }) {
  return (
    <SdkPopoverContent data-kit="popover" side={side} align={align} sideOffset={sideOffset} {...props}>
      <div data-kit="popover-surface">{children}</div>
    </SdkPopoverContent>
  )
}

export { Popover, PopoverClose, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger }
