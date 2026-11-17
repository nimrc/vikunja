import * as React from "react"
import {
  AlertDialog as SdkAlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog"
import { Icon } from "@/components/ui/icon"

// Without a trigger, open it with `open` and `onOpenChange`. A Promise from
// `onConfirm` keeps it open and the confirm key pending until it settles; a
// rejection leaves it open.
function AlertDialog({
  trigger,
  label,
  title,
  description,
  confirm,
  cancel = "Cancel",
  onConfirm,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode
  /** The trigger's accessible name, for a trigger that's only an icon. */
  label?: string
  title: React.ReactNode
  description: React.ReactNode
  confirm: string
  cancel?: string
  onConfirm?: () => unknown
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <SdkAlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <AlertDialogTrigger data-kit="button" data-tone="secondary" aria-label={label}>
          {trigger}
        </AlertDialogTrigger>
      )}
      <AlertDialogBackdrop data-kit="backdrop" />
      <AlertDialogContent data-kit="dialog">
        <div data-kit="dialog-surface">
          <AlertDialogTitle data-kit="dialog-title">{title}</AlertDialogTitle>
          <AlertDialogDescription data-kit="dialog-description">{description}</AlertDialogDescription>
          <div data-kit="actions">
            <AlertDialogClose data-kit="button" data-tone="secondary">
              <Icon name="close" />
              {cancel}
            </AlertDialogClose>
            <AlertDialogClose data-kit="button" data-tone="primary" value="confirm" action={onConfirm && (() => onConfirm())}>
              <Icon name="trash" />
              {confirm}
            </AlertDialogClose>
          </div>
        </div>
      </AlertDialogContent>
    </SdkAlertDialog>
  )
}

export { AlertDialog }
