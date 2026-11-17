import * as React from "react"
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@ui-sdk/react/menu"
import { Icon } from "@/components/ui/icon"
import { chosenItem } from "@/lib/chosen-item"

// A menu on the kit's popup screen, built on ui-sdk so it shares the top layer
// with the kit's dialogs; a Radix menu would portal behind an open dialog.

const DropdownMenu = Menu

// `asChild` makes the child element the trigger, unstyled.
function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuTrigger>, "children"> & { asChild?: boolean; children?: React.ReactNode }) {
  if (asChild && React.isValidElement<Record<string, unknown>>(children)) {
    return <MenuTrigger render={children} {...props} />
  }
  return <MenuTrigger {...props}>{children}</MenuTrigger>
}

function DropdownMenuContent({
  align = "start",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof MenuContent>) {
  return <MenuContent data-kit="popup" align={align} sideOffset={sideOffset} {...props} />
}

function DropdownMenuItem({
  variant,
  asChild,
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuItem>, "children"> & {
  variant?: "default" | "destructive"
  asChild?: boolean
  children?: React.ReactNode
}) {
  const render = asChild && React.isValidElement<Record<string, unknown>>(children) ? children : undefined
  return (
    <MenuItem
      data-kit="option"
      destructive={variant === "destructive"}
      render={render}
      {...chosenItem}
      {...props}
    >
      {render ? undefined : children}
    </MenuItem>
  )
}

function DropdownMenuCheckboxItem({
  value,
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuCheckboxItem>, "value" | "children"> & {
  value?: string
  children?: React.ReactNode
}) {
  const id = React.useId()
  return (
    <MenuCheckboxItem data-kit="option" value={value ?? id} {...props}>
      <MenuItemIndicator data-kit="option-check" keepMounted>
        <Icon name="check" />
      </MenuItemIndicator>
      {children}
    </MenuCheckboxItem>
  )
}

const DropdownMenuRadioGroup = MenuRadioGroup

function DropdownMenuRadioItem({
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuRadioItem>, "children"> & { children?: React.ReactNode }) {
  return (
    <MenuRadioItem data-kit="option" {...chosenItem} {...props}>
      <MenuItemIndicator data-kit="option-check" keepMounted>
        <Icon name="check" />
      </MenuItemIndicator>
      {children}
    </MenuRadioItem>
  )
}

const DropdownMenuGroup = MenuGroup

function DropdownMenuLabel(props: React.ComponentProps<typeof MenuGroupLabel>) {
  return <MenuGroupLabel data-kit="label" {...props} />
}

function DropdownMenuSeparator(props: React.ComponentProps<typeof MenuSeparator>) {
  return <MenuSeparator data-kit="separator" {...props} />
}

const DropdownMenuShortcut = MenuShortcut

const DropdownMenuSub = MenuSub

function DropdownMenuSubTrigger({
  children,
  ...props
}: Omit<React.ComponentProps<typeof MenuSubTrigger>, "children"> & { children?: React.ReactNode }) {
  return (
    <MenuSubTrigger data-kit="option" {...props}>
      {children}
      <Icon name="next" />
    </MenuSubTrigger>
  )
}

function DropdownMenuSubContent({ sideOffset = 4, ...props }: React.ComponentProps<typeof MenuSubContent>) {
  return <MenuSubContent data-kit="popup" sideOffset={sideOffset} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
