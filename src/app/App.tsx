import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
  useNavigate,
  useOutletContext,
  useSearchParams,
} from 'react-router-dom'
import { PreferencesContext, usePreferences } from './PreferencesContext'
import { applyTheme, readTheme, THEME_KEY } from '../themes/settings'
import { readPreference, writePreference } from '../data/local-preferences'
import type { Theme } from '../domain/types'
import { useConnectivity } from '../hooks/useConnectivity'
import { StatusPage } from '../features/status/StatusPage'
import { QuestsPage } from '../features/quests/QuestsPage'
import { QuestArchive } from '../features/quests/QuestArchive'
import { TodosPage } from '../features/todos/TodosPage'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { HobbiesPage } from '../features/hobbies/HobbiesPage'
import { HobbyEditor } from '../features/hobbies/HobbyEditor'
import { HobbyArchive } from '../features/hobbies/HobbyArchive'
import { HubPage } from '../features/hub/HubPage'
import { SettingsPage } from '../features/hub/SettingsPage'
import { GuidePage, SleepPage } from '../features/hub/SupportingPages'
import { EmptyState, PageHeader } from '../components/ui'
import { SupabaseAuthRepository, SupabaseProfileRepository, supabaseClient } from '../data/supabase'
import { MorningReport } from '../features/reports/MorningReport'
const tabs = [
  { to: '/status', label: 'Status', Icon: Activity },
  { to: '/quests', label: 'Quests', Icon: SquareCheck },
  { to: '/todos', label: 'To-Dos', Icon: List },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/hobbies', label: 'Hobbies', Icon: Compass },
  { to: '/hub', label: 'Hub', Icon: Grid2X2 },
]
const NAME_KEY = 'progression.preview-name.v1'
interface ShellContext {
  authorize: () => void
  unauthorize: () => void
}
function Shell() {
  const online = useConnectivity()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const reportLastCheckedAt = useRef(0)
  const previousPath = useRef<string | null>(null)
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const [authorized, setAuthorized] = useState<boolean | null>(configured ? null : true)
  const [reportError, setReportError] = useState('')
  useEffect(() => {
    if (!configured || pathname === '/login') return
    let active = true
    new SupabaseAuthRepository()
      .getSession()
      .then((session) => {
        if (active) setAuthorized(Boolean(session))
      })
      .catch(() => {
        if (active) setAuthorized(false)
      })
    return () => {
      active = false
    }
  }, [configured, pathname])
  useEffect(() => {
    if (!configured || authorized !== true || pathname === '/login') return
    let checking = false
    async function checkReport() {
      if (
        checking ||
        !navigator.onLine ||
        document.hidden ||
        Date.now() - reportLastCheckedAt.current < 60_000
      )
        return
      checking = true
      reportLastCheckedAt.current = Date.now()
      try {
        const { data, error } = await supabaseClient().rpc('claim_morning_report')
        if (error) {
          setReportError(error.message)
          return
        }
        setReportError('')
        if (data) navigate(`/report/${data}`, { replace: true })
      } catch (cause) {
        setReportError(cause instanceof Error ? cause.message : 'Could not check report.')
      } finally {
        checking = false
      }
    }
    const recheck = () => void checkReport()
    recheck()
    const interval = window.setInterval(recheck, 60_000)
    window.addEventListener('online', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [authorized, configured, navigate, pathname])
  useEffect(() => {
    document.title = `${tabs.find((tab) => pathname.startsWith(tab.to))?.label ?? 'Progression System'} · Progression System`
    if (previousPath.current !== null && previousPath.current !== pathname) {
      window.scrollTo(0, 0)
      document.getElementById('main')?.focus()
    }
    previousPath.current = pathname
  }, [pathname])
  if (configured && pathname !== '/login' && authorized === null)
    return <p className="loading-screen">Loading private account…</p>
  if (configured && pathname !== '/login' && authorized === false)
    return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="preview-bar">
        <span className="preview-dot" aria-hidden="true" />
        {configured ? 'Private account' : 'Local preview'}
        <span className="preview-detail">
          {configured ? 'Server connected' : 'Backend not connected'}
        </span>
      </div>
      {!online && (
        <div className="offline-banner" role="status">
          Offline · activity recording requires a connection. Nothing is being synced.
        </div>
      )}
      {reportError && (
        <p className="form-error" role="alert">
          Morning Report: {reportError}
        </p>
      )}
      <main
        id="main"
        tabIndex={-1}
        className={`main-content ${['/status', '/quests', '/calendar'].some((route) => pathname.startsWith(route)) ? 'wide-page' : 'narrow-page'}`}
      >
        <Outlet
          context={
            {
              authorize: () => setAuthorized(true),
              unauthorize: () => setAuthorized(null),
            } satisfies ShellContext
          }
        />
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
function ReportRoute() {
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const { pathname } = useLocation()
  const [authorized, setAuthorized] = useState<boolean | null>(configured ? null : true)
  useEffect(() => {
    if (!configured) return
    let active = true
    new SupabaseAuthRepository()
      .getSession()
      .then((session) => {
        if (active) setAuthorized(Boolean(session))
      })
      .catch(() => {
        if (active) setAuthorized(false)
      })
    return () => {
      active = false
    }
  }, [configured])
  if (authorized === null) return <p className="loading-screen">Loading private account…</p>
  if (!authorized) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />
  return <MorningReport />
}
function LoginPage() {
  const { refreshAccount } = usePreferences()
  const { authorize } = useOutletContext<ShellContext>()
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const session = await new SupabaseAuthRepository().signIn(email, password)
      const db = supabaseClient()
      const { data: profile, error: loadError } = await db
        .from('profiles')
        .select('user_id')
        .eq('user_id', session.userId)
        .maybeSingle()
      if (loadError) throw loadError
      if (!profile) {
        const { error: createError } = await db.from('profiles').insert({ user_id: session.userId })
        if (createError) throw createError
      }
      await refreshAccount()
      authorize()
      const next = params.get('next')
      navigate(next?.startsWith('/') && !next.startsWith('//') ? next : '/status')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeader title="Private account" back="/status" />
      {configured ? (
        <form className="login-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="save-button" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <EmptyState title="Sign-in is not connected yet.">
          Connect a private Supabase project to use owner sign-in. This local preview contains no
          account activity.
        </EmptyState>
      )}
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
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const [theme, setThemeState] = useState(readTheme)
  const [name, setNameState] = useState(() =>
    configured ? 'Player' : readPreference(NAME_KEY)?.trim().slice(0, 60) || 'Player',
  )
  const [storageError, setStorageError] = useState(false)
  useEffect(() => applyTheme(theme), [theme])
  const refreshAccount = useCallback(async () => {
    if (!configured) return
    const db = supabaseClient()
    const { data, error } = await db.auth.getUser()
    if (error) throw error
    if (!data.user) return
    const profile = await new SupabaseProfileRepository(db).load()
    setThemeState(profile.theme)
    setNameState(profile.displayName)
    setStorageError(!writePreference(THEME_KEY, profile.theme))
  }, [configured])
  useEffect(() => {
    if (!configured) return
    const refresh = () => {
      if (navigator.onLine) void refreshAccount().catch(() => {})
    }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [configured, refreshAccount])
  function setTheme(value: Theme) {
    setThemeState(value)
    setStorageError(!writePreference(THEME_KEY, value))
  }
  function setName(value: string) {
    setNameState(value)
    if (!configured) setStorageError(!writePreference(NAME_KEY, value))
  }
  function clearAccount() {
    setNameState('Player')
  }
  if (import.meta.env.PROD && !configured)
    return (
      <main className="loading-screen" role="alert">
        <h1>Sign-in is unavailable</h1>
        <p>
          This deployment is missing its public Supabase connection settings. The site owner needs
          to configure them in the hosting project and redeploy.
        </p>
      </main>
    )
  return (
    <PreferencesContext.Provider
      value={{ theme, setTheme, name, setName, refreshAccount, clearAccount, storageError }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="report/:date" element={<ReportRoute />} />
          <Route element={<Shell />}>
            <Route index element={<Navigate to="/status" replace />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="quests" element={<QuestsPage />} />
            <Route path="quests/new" element={<QuestsPage />} />
            <Route path="todos" element={<TodosPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="hobbies" element={<HobbiesPage />} />
            <Route
              path="hobbies/:id/edit"
              element={
                <>
                  <PageHeader title="Hobbies" back="/hobbies" />
                  <HobbyEditor />
                </>
              }
            />
            <Route path="hub" element={<HubPage />} />
            <Route path="hub/settings" element={<SettingsPage />} />
            <Route path="hub/sleep" element={<SleepPage />} />
            <Route path="hub/quest-archive" element={<QuestArchive />} />
            <Route path="hub/hobby-archive" element={<HobbyArchive />} />
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
