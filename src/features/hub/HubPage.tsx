import { MenuRow, PageHeader, Section } from '../../components/ui'
export function HubPage() {
  return (
    <>
      <PageHeader title="Hub" />
      <Section title="Tools">
        <MenuRow title="Sleep Log" description="Record & review bedtimes" to="/hub/sleep" />
      </Section>
      <Section title="Archives">
        <MenuRow
          title="Quest Archive"
          description="Archived & completed one-time quests"
          to="/hub/quest-archive"
        />
        <MenuRow
          title="Hobby Archive"
          description="Paused & finished projects"
          to="/hub/hobby-archive"
        />
        <MenuRow title="To-Do Archive" description="Completed checklists" to="/todos?archive=1" />
      </Section>
      <Section title="Settings">
        <MenuRow
          title="Settings"
          description="Profile, appearance, system rules & guide"
          to="/hub/settings"
        />
      </Section>
    </>
  )
}
