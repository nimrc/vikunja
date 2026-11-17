import * as React from "react"
import { Collapsible as SdkCollapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible"

function Collapsible({
  title,
  children,
  open,
  defaultOpen,
  onOpenChange,
}: {
  title: React.ReactNode
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <SdkCollapsible data-kit="collapsible" open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger data-kit="accordion-trigger">{title}</CollapsibleTrigger>
      <CollapsiblePanel data-kit="accordion-panel">{children}</CollapsiblePanel>
    </SdkCollapsible>
  )
}

export { Collapsible }
