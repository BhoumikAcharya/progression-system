import { STAT_KEYS, type StatEffects } from '../domain/types'
import { statDetails } from './statDetails'

export function StatEditor({
  effects,
  onChange,
}: {
  effects: StatEffects
  onChange: (value: StatEffects) => void
}) {
  return (
    <div className="stat-editor">
      {STAT_KEYS.map((key) => {
        const { name, Icon } = statDetails[key]
        return (
          <div className="stat-edit-row" key={key}>
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <span className="stat-edit-name">
              {name}
              <small>{key}</small>
            </span>
            <button
              type="button"
              aria-label={`Decrease ${name}`}
              onClick={() => onChange({ ...effects, [key]: effects[key] - 1 })}
            >
              −
            </button>
            <output
              className={effects[key] > 0 ? 'positive' : effects[key] < 0 ? 'negative' : 'muted'}
              aria-label={`${name} effect`}
            >
              {effects[key] > 0 ? '+' : ''}
              {effects[key]}
            </output>
            <button
              type="button"
              aria-label={`Increase ${name}`}
              onClick={() => onChange({ ...effects, [key]: effects[key] + 1 })}
            >
              +
            </button>
          </div>
        )
      })}
    </div>
  )
}
