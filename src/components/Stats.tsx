import { BookOpen, Dumbbell, Heart, Shield, Wallet } from 'lucide-react'
import { STAT_KEYS, type StatEffects } from '../domain/types'
const statDetails = {
  STR: { name: 'Strength', Icon: Dumbbell },
  INT: { name: 'Intelligence', Icon: BookOpen },
  VIT: { name: 'Vitality', Icon: Heart },
  DIS: { name: 'Discipline', Icon: Shield },
  BNK: { name: 'Bank', Icon: Wallet },
}
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
