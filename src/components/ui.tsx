import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
export function PageHeader({
  title,
  subtitle,
  back,
}: {
  title: string
  subtitle?: string
  back?: string
}) {
  return (
    <header className="page-header">
      <div className="flex items-center gap-2">
        {back && (
          <Link className="icon-button" to={back} aria-label="Back">
            <ChevronLeft size={22} />
          </Link>
        )}
        <h1>{title}</h1>
      </div>
      {subtitle && <p>{subtitle}</p>}
    </header>
  )
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-label">{title}</h2>
      {children}
    </section>
  )
}
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  )
}
export function MenuRow({
  title,
  description,
  to,
}: {
  title: string
  description: string
  to: string
}) {
  return (
    <Link className="menu-row" to={to}>
      <div>
        <span className="row-title">{title}</span>
        <p>{description}</p>
      </div>
      <ChevronRight size={18} />
    </Link>
  )
}
export function Divider() {
  return (
    <div className="ornament" aria-hidden="true">
      <span>◆</span>
    </div>
  )
}
export function Segments<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segments" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option} aria-pressed={value === option} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  )
}
