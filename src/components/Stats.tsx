import { statDetails } from './statDetails'
import { STAT_KEYS, type StatEffects } from '../domain/types'
export function Stats({ values }: { values: StatEffects }) {
  return (
    <dl className="stats">
      {STAT_KEYS.map((key) => {
        const { name, Icon } = statDetails[key]
        return (
          <div key={key} aria-label={name}>
            <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
            <dt>{key}</dt>
            <dd>{values[key]}</dd>
          </div>
        )
      })}
    </dl>
  )
}
