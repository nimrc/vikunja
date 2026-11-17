import * as React from "react"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

function Alert({
  tone = "info",
  title,
  action,
  children,
}: {
  tone?: Tone
  title: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div data-kit="alert" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <div data-kit="legend">
        <span data-kit="alert-led" aria-hidden />
        <strong data-kit="alert-title">{title}</strong>
      </div>
      {children && <div data-kit="alert-description">{children}</div>}
      {action}
    </div>
  )
}

export { Alert }
