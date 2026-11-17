import * as React from "react"

function Card({
  title,
  description,
  action,
  children,
  footer,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section data-kit="card" aria-label={typeof title === "string" ? title : undefined} {...props}>
      {(title || description || action) && (
        <header data-kit="card-header">
          <div>
            {title && <h3 data-kit="card-title">{title}</h3>}
            {description && <p data-kit="card-description">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div data-kit="card-body">{children}</div>
      {footer && <footer data-kit="card-footer">{footer}</footer>}
    </section>
  )
}

export { Card }
