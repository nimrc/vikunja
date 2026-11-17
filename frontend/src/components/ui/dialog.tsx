import * as React from "react"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent as SdkDialogContent,
  DialogDescription as SdkDialogDescription,
  DialogTitle as SdkDialogTitle,
  DialogTrigger as SdkDialogTrigger,
} from "@ui-sdk/react/dialog"

// The kit's dialog, in parts: a raised surface over a dim backdrop, its title
// and description printed on it, and a row of keys for its actions.
function DialogTrigger({ tone = "secondary", ...props }: React.ComponentProps<typeof SdkDialogTrigger> & { tone?: "primary" | "secondary" }) {
  return <SdkDialogTrigger data-kit="button" data-tone={tone} {...props} />
}

// `size="lg"` is a near-full-screen dialog for a whole page of content, like
// a task; the kit's own dialogs are 360px.
function DialogContent({
  children,
  size,
  ...props
}: Omit<React.ComponentProps<typeof SdkDialogContent>, "children"> & { children?: React.ReactNode; size?: "lg" }) {
  return (
    <>
      <DialogBackdrop data-kit="backdrop" />
      <SdkDialogContent data-kit="dialog" data-size={size} {...props}>
        <div data-kit="dialog-surface">{children}</div>
      </SdkDialogContent>
    </>
  )
}

function DialogTitle(props: React.ComponentProps<typeof SdkDialogTitle>) {
  return <SdkDialogTitle data-kit="dialog-title" {...props} />
}

function DialogDescription(props: React.ComponentProps<typeof SdkDialogDescription>) {
  return <SdkDialogDescription data-kit="dialog-description" {...props} />
}

function DialogActions(props: React.ComponentProps<"div">) {
  return <div data-kit="actions" {...props} />
}

export { Dialog, DialogActions, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger }
