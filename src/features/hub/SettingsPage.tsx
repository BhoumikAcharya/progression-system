import { useState, type FormEvent } from 'react'
import { usePreferences } from '../../app/PreferencesContext'
import { MenuRow, PageHeader, Section } from '../../components/ui'
export function SettingsPage() {
  const { theme, setTheme, name, setName, storageError } = usePreferences()
  const [draft, setDraft] = useState(name)
  const [saved, setSaved] = useState(false)
  function save(event: FormEvent) {
    event.preventDefault()
    const value = draft.trim()
    if (value) {
      setName(value)
      setSaved(true)
    }
  }
  return (
    <>
      <PageHeader title="Settings" back="/hub" />
      <Section title="Player profile">
        <form onSubmit={save}>
          <label className="field-label" htmlFor="player-name">
            Player name
          </label>
          <div className="profile-input">
            <input
              id="player-name"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setSaved(false)
              }}
              maxLength={60}
              required
            />
            <button className="outline-button" type="submit">
              Save name
            </button>
          </div>
          <p className="meta" role="status">
            {storageError
              ? 'Browser storage unavailable. Preferences apply for this visit only.'
              : saved
                ? 'Name saved on this device only.'
                : 'Local preview profile · Asia/Kolkata'}
          </p>
        </form>
      </Section>
      <Section title="Appearance">
        <fieldset className="theme-picker">
          <legend>Theme</legend>
          {(
            [
              {
                value: 'inked-fantasy',
                label: 'Inked Fantasy',
                description: 'Warm black · brass · serif',
                style: 'ink-swatch',
              },
              {
                value: 'oled-black',
                label: 'OLED Black',
                description: 'Pure black · monochrome · sans',
                style: 'oled-swatch',
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`theme-option ${theme === option.value ? 'chosen' : ''}`}
            >
              <span className={`theme-swatch ${option.style}`} aria-hidden="true">
                Aa
              </span>
              <span className="grow">
                <span className="row-title">{option.label}</span>
                <small>{option.description}</small>
              </span>
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={() => setTheme(option.value)}
              />
            </label>
          ))}
        </fieldset>
        <p className="meta">
          Appearance applies instantly. Saved on this device; account sync is pending.
        </p>
      </Section>
      <Section title="System rules & guide">
        <MenuRow
          title="How progression works"
          description="Stats · XP · levels · 03:00 reset · streaks · sleep"
          to="/hub/guide"
        />
      </Section>
      <Section title="Data & backup">
        <div className="plain-row">
          <span className="row-title">Device sync</span>
          <p>Not connected — local UI preview only.</p>
        </div>
        <div className="plain-row">
          <span className="row-title">Export / backup</span>
          <p>
            Available after authenticated history is connected. No activity data is stored in this
            preview.
          </p>
        </div>
        <MenuRow
          title="Private account"
          description="Authentication setup is pending"
          to="/login"
        />
      </Section>
    </>
  )
}
