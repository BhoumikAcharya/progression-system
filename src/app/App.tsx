import { useEffect, useState } from 'react'
import { Activity, CalendarDays, Compass, Grid2X2, List, SquareCheck } from 'lucide-react'
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { PreferencesContext } from './PreferencesContext'
import { applyTheme, readTheme, THEME_KEY } from '../themes/settings'
import { readPreference, writePreference } from '../data/local-preferences'
import type { Theme } from '../domain/types'
import { useConnectivity } from '../hooks/useConnectivity'
import { StatusPage } from '../features/status/StatusPage'
import { QuestsPage } from '../features/quests/QuestsPage'
import { TodosPage } from '../features/todos/TodosPage'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { HobbiesPage } from '../features/hobbies/HobbiesPage'
import { HubPage } from '../features/hub/HubPage'
import { SettingsPage } from '../features/hub/SettingsPage'
import { ArchivePage, GuidePage, SleepPage } from '../features/hub/SupportingPages'
import { EmptyState, PageHeader } from '../components/ui'
const tabs = [
  { to: '/status', label: 'Status', Icon: Activity },
  { to: '/quests', label: 'Quests', Icon: SquareCheck },
  { to: '/todos', label: 'To-Dos', Icon: List },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/hobbies', label: 'Hobbies', Icon: Compass },
  { to: '/hub', label: 'Hub', Icon: Grid2X2 },
]
const NAME_KEY = 'progression.preview-name.v1'
function Shell() {
  const online = useConnectivity()
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = `${tabs.find((tab) => pathname.startsWith(tab.to))?.label ?? 'Progression System'} · Progression System`
    window.scrollTo(0, 0)
    document.getElementById('main')?.focus()
  }, [pathname])
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="preview-bar">
        <span className="preview-dot" aria-hidden="true" />
        Local preview<span className="preview-detail">Backend not connected</span>
      </div>
      {!online && (
        <div className="offline-banner" role="status">
          Offline · activity recording requires a connection. Nothing is being synced.
        </div>
      )}
      <main
        id="main"
        tabIndex={-1}
        className={`main-content ${['/status', '/quests', '/calendar'].some((route) => pathname.startsWith(route)) ? 'wide-page' : 'narrow-page'}`}
      >
        <Outlet />
      </main>
      <footer className="nav-footer">
        <nav className="tab-bar" aria-label="Primary navigation">
          {tabs.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </footer>
    </div>
  )
}
function LoginPage() {
  return (
    <>
      <PageHeader title="Private account" back="/hub/settings" />
      <EmptyState title="Sign-in is not connected yet.">
        This milestone contains a local UI preview only. Owner sign-in and server-enforced access
        will be connected with Supabase in Milestone 2.
      </EmptyState>
      <Link to="/status" className="text-link">
        Return to local preview
      </Link>
    </>
  )
}
/** Fail closed. TODO M2: replace with verified Supabase session gate, then RLS on every query. */
function RequireSession() {
  return <Navigate to="/login" replace />
}
function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Link className="text-link" to="/status">
        Return to Status
      </Link>
    </>
  )
}
export function App() {
  const [theme, setThemeState] = useState(readTheme)
  const [name, setNameState] = useState(
    () => readPreference(NAME_KEY)?.trim().slice(0, 60) || 'Player',
  )
  const [storageError, setStorageError] = useState(false)
  useEffect(() => applyTheme(theme), [theme])
  function setTheme(value: Theme) {
    setThemeState(value)
    setStorageError(!writePreference(THEME_KEY, value))
  }
  function setName(value: string) {
    setNameState(value)
    setStorageError(!writePreference(NAME_KEY, value))
  }
  return (
    <PreferencesContext.Provider value={{ theme, setTheme, name, setName, storageError }}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Navigate to="/status" replace />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="quests" element={<QuestsPage />} />
            <Route path="quests/new" element={<QuestsPage />} />
            <Route path="todos" element={<TodosPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="hobbies" element={<HobbiesPage />} />
            <Route path="hub" element={<HubPage />} />
            <Route path="hub/settings" element={<SettingsPage />} />
            <Route path="hub/sleep" element={<SleepPage />} />
            <Route path="hub/quest-archive" element={<ArchivePage kind="Quest" />} />
            <Route path="hub/hobby-archive" element={<ArchivePage kind="Hobby" />} />
            <Route path="hub/guide" element={<GuidePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="private/*" element={<RequireSession />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PreferencesContext.Provider>
  )
}
