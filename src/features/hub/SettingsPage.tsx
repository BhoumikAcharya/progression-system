import { useState, type FormEvent } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { usePreferences } from '../../app/PreferencesContext'
import { MenuRow, PageHeader, Section } from '../../components/ui'
import { downloadPrivateExport, fetchPrivateExport } from '../../data/export'
import { SupabaseAuthRepository, SupabaseProfileRepository } from '../../data/supabase'
import { describeError } from '../../data/errors'
import { setSleepCollapsedByDefault, sleepCollapsedByDefault } from '../../data/sleep-preferences'
import type { Theme } from '../../domain/types'
export function SettingsPage() {
  const { theme, setTheme, name, setName, clearAccount, storageError } = usePreferences()
  const { unauthorize } = useOutletContext<{ unauthorize: () => void }>()
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [editingName, setEditingName] = useState(false)
  const visibleName = editingName ? draft : name
  const [saved, setSaved] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [themeSaving, setThemeSaving] = useState(false)
  const [themeMessage, setThemeMessage] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [sleepCollapsed, setSleepCollapsed] = useState(sleepCollapsedByDefault)
  const [sleepPreferenceError, setSleepPreferenceError] = useState(false)
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  async function exportHistory() {
    setExporting(true)
    setExportMessage('')
    try {
      downloadPrivateExport(await fetchPrivateExport())
      setExportMessage('JSON backup downloaded to this device. Keep it private.')
    } catch (cause) {
      setExportMessage(describeError(cause, 'Export failed. Please retry.'))
    } finally {
      setExporting(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    const value = visibleName.trim()
    if (!value) return
    setNameError('')
    setNameSaving(true)
    try {
      if (configured) {
        const result = await new SupabaseProfileRepository().updatePreferences({
          displayName: value,
        })
        if (result.status !== 'saved') throw new Error(result.message)
      }
      setName(value)
      setEditingName(false)
      setSaved(true)
    } catch (cause) {
      setNameError(describeError(cause, 'Could not save name. Retry.'))
    } finally {
      setNameSaving(false)
    }
  }
  async function chooseTheme(value: Theme) {
    const previous = theme
    setTheme(value)
    setThemeMessage('')
    if (!configured) return
    setThemeSaving(true)
    try {
      const result = await new SupabaseProfileRepository().updatePreferences({ theme: value })
      if (result.status !== 'saved') throw new Error(result.message)
      setThemeMessage('Appearance saved to your account.')
    } catch (cause) {
      setTheme(previous)
      setThemeMessage(describeError(cause, 'Could not save appearance. Retry.'))
    } finally {
      setThemeSaving(false)
    }
  }
  async function signOut() {
    setSigningOut(true)
    setSignOutError('')
    try {
      await new SupabaseAuthRepository().signOut()
      clearAccount()
      navigate('/login', { replace: true })
      unauthorize()
    } catch (cause) {
      setSignOutError(describeError(cause, 'Could not sign out. Retry.'))
    } finally {
      setSigningOut(false)
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
              value={visibleName}
              onChange={(e) => {
                setDraft(e.target.value)
                setEditingName(true)
                setSaved(false)
              }}
              maxLength={60}
              required
            />
            <button className="outline-button" type="submit" disabled={nameSaving}>
              {nameSaving ? 'Saving…' : 'Save name'}
            </button>
          </div>
          {nameError && (
            <p className="form-error" role="alert">
              {nameError}
            </p>
          )}
          <p className="meta" role="status">
            {saved
              ? configured
                ? 'Name saved to your account.'
                : 'Name saved on this device only.'
              : configured
                ? 'Player name is loaded from your account when online.'
                : 'Local preview profile · Asia/Kolkata'}
          </p>
          {storageError && (
            <p className="meta">Browser preference cache unavailable for this visit.</p>
          )}
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
                disabled={themeSaving}
                onChange={() => void chooseTheme(option.value)}
              />
            </label>
          ))}
        </fieldset>
        <p className="meta">
          {configured
            ? 'Appearance applies instantly and is saved to your account when online.'
            : 'Appearance applies instantly and is saved on this device.'}
        </p>
        {themeMessage && (
          <p className="meta" role="status">
            {themeMessage}
          </p>
        )}
      </Section>
      <Section title="Sleep Check-In">
        <label className="setting-toggle">
          <span>
            <strong>Collapsed by default</strong>
            <small>Expand Sleep Check-In when you want to record or review a night.</small>
          </span>
          <input
            type="checkbox"
            checked={sleepCollapsed}
            onChange={(event) => {
              const value = event.target.checked
              if (setSleepCollapsedByDefault(value)) {
                setSleepCollapsed(value)
                setSleepPreferenceError(false)
              } else setSleepPreferenceError(true)
            }}
          />
        </label>
        {sleepPreferenceError && (
          <p className="form-error" role="alert">
            Could not save this device setting.
          </p>
        )}
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
          <p>
            {configured
              ? 'Account data is read from the server when online. No last-sync time is tracked.'
              : 'Not connected — local UI preview only.'}
          </p>
        </div>
        <div className="plain-row">
          <span className="row-title">Export / backup</span>
          <p>
            {configured
              ? 'Download your full account history as a private, versioned JSON file. Import is not available yet.'
              : 'Available after authenticated history is connected. No activity data is stored in this preview.'}
          </p>
          {configured && (
            <button
              className="outline-button"
              type="button"
              disabled={exporting}
              onClick={() => void exportHistory()}
            >
              {exporting ? 'Preparing export…' : 'Download JSON backup'}
            </button>
          )}
          {exportMessage && <p role="status">{exportMessage}</p>}
        </div>
        <MenuRow
          title="Private account"
          description={
            configured ? 'Sign in or manage this session' : 'Authentication setup is pending'
          }
          to="/login"
        />
        {configured && (
          <div className="plain-row">
            <button
              className="text-link"
              type="button"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
            {signOutError && (
              <p className="form-error" role="alert">
                {signOutError}
              </p>
            )}
          </div>
        )}
      </Section>
    </>
  )
}
