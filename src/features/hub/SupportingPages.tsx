import { EmptyState, PageHeader, Section } from '../../components/ui'
import { SleepCheckIn } from '../quests/QuestsPage'
export function SleepPage() {
  return (
    <>
      <PageHeader
        title="Sleep Log"
        back="/hub"
        subtitle="Sleep-night records · separate from the 03:00 quest reset"
      />
      <SleepCheckIn />
      <Section title="Recent nights">
        <EmptyState title="No nights recorded.">
          Sleep Log, Quests, and Calendar will share the same record once connected.
        </EmptyState>
      </Section>
    </>
  )
}
export function ArchivePage({ kind }: { kind: 'Quest' | 'Hobby' }) {
  return (
    <>
      <PageHeader title={`${kind} Archive`} back="/hub" />
      <Section title={kind === 'Quest' ? 'Archived · can restore' : 'Paused · can restore'}>
        <p className="meta">Nothing archived yet.</p>
      </Section>
      <Section title={kind === 'Quest' ? 'Completed one-time · view only' : 'Finished · permanent'}>
        <p className="meta">Nothing completed yet. Earned history will be preserved.</p>
      </Section>
    </>
  )
}
export function GuidePage() {
  return (
    <>
      <PageHeader title="System guide" back="/hub/settings" />
      <Section title="Attributes & XP">
        <p>
          Strength, Intelligence, Vitality, Discipline, and Bank begin at zero and never display
          below zero. Each positive awarded point earns 150 XP. Negative outcomes do not directly
          remove XP.
        </p>
      </Section>
      <Section title="Levels">
        <p>
          The first level requires 400 XP. Each following transition costs the previous requirement
          × 1.15, rounded up. Unlocked levels never decrease; correcting an incorrect award also
          corrects its XP.
        </p>
      </Section>
      <Section title="Quests & streaks">
        <p>
          The quest day resets at 03:00 in your account time zone. Every third consecutive scheduled
          completion adds one point in the configured direction for each affected stat. Volatile
          streaks require the same recorded outcome. Missing a quest never records a negative
          outcome.
        </p>
      </Section>
      <Section title="Sleep & Energy">
        <p>
          9–11 PM: VIT +1, DIS +1, Excellent Energy. 11 PM–1 AM: no stat changes, Medium Energy.
          After 1 AM: DIS −1, Low Energy. Sleep effects belong to the sleep night; Energy belongs to
          the following day. No record means Energy is “-”.
        </p>
      </Section>
      <Section title="A separate space">
        <p>
          To-Dos have no dates, stats, XP, or streaks. Routine rewards belong only to the parent.
          Hobby subtasks earn independently; a configured finish bonus is awarded exactly once.
        </p>
      </Section>
    </>
  )
}
