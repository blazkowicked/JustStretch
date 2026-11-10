import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DangerButton, InputError, InputLabel, PrimaryButton, SecondaryButton, TextInput } from '../components/forms.jsx'
import Icon from '../components/Icon.jsx'
import PasswordChecklist from '../components/PasswordChecklist.jsx'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import AppLayout from '../layouts/AppLayout.jsx'
import { api } from '../lib/api.js'
import { PAIN_AREAS, areaLabel } from '../lib/enums.js'
import { formatDate, initials, timeAgo } from '../lib/format.js'
import { useFetch, useForm } from '../lib/hooks.js'
import { btn, card, pageTitle } from '../lib/ui.js'

const SECTIONS = [
  { id: 'body', label: 'Body map', icon: 'body' },
  { id: 'flexibility', label: 'Flexibility', icon: 'chart' },
  { id: 'profile', label: 'Name', icon: 'user' },
  { id: 'email', label: 'Email', icon: 'mail' },
  { id: 'password', label: 'Password', icon: 'key' },
  { id: 'sessions', label: 'Sessions', icon: 'users' },
  { id: 'delete', label: 'Delete account', icon: 'trash' },
]

// The three flexibility tests, with the unit each one is measured in.
const TESTS = [
  { id: 'sit_and_reach', label: 'Sit and reach', unit: 'cm', min: 0, max: 200 },
  { id: 'neck_range', label: 'Neck range', unit: '1-5', min: 1, max: 5 },
  { id: 'shoulder_range', label: 'Shoulder range', unit: '1-5', min: 1, max: 5 },
]

// Where each area button sits on the silhouette, from the head down.
const AREA_POSITIONS = {
  neck: 'top-[9%]',
  shoulders: 'top-[18%]',
  upper_back: 'top-[31%]',
  lower_back: 'top-[43%]',
  hips: 'top-[57%]',
  quads: 'top-[72%]',
  hamstrings: 'top-[85%]',
}

// "Saved." disappears after two seconds. Render it with a new `key` each time to show it again.
function SavedNote() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  return visible ? (
    <p className="inline-flex items-center gap-1.5 text-sm font-medium text-accent" role="status">
      <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
      Saved
    </p>
  ) : null
}

function describeSession(userAgent = '') {
  const ua = String(userAgent)
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /CriOS|Chrome\//.test(ua)
        ? 'Chrome'
        : /FxiOS|Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Unknown browser'
  const platform = /Windows NT/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown device'
  return `${browser} on ${platform}`
}

function SectionHeader({ title, danger = false, children }) {
  return (
    <header className={`-mx-5 -mt-5 mb-5 border-b px-5 py-4 sm:-mx-6 sm:-mt-6 sm:px-6 ${danger ? 'border-danger-line bg-danger-soft' : 'border-line bg-paper-2'}`}>
      <h2 className={`text-base font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>{title}</h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-2">{children}</p>
    </header>
  )
}

// A simple front-facing silhouette, so the buttons land on the part they name.
function BodySilhouette() {
  return (
    <svg viewBox="0 0 200 400" className="absolute inset-0 h-full w-full text-paper-2" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <circle cx="100" cy="26" r="18" />
        <rect x="92" y="42" width="16" height="14" rx="6" />
        <rect x="64" y="56" width="72" height="172" rx="26" />
        <rect x="40" y="62" width="18" height="150" rx="9" />
        <rect x="142" y="62" width="18" height="150" rx="9" />
        <rect x="70" y="224" width="26" height="158" rx="13" />
        <rect x="104" y="224" width="26" height="158" rx="13" />
      </g>
    </svg>
  )
}

const areaButton = (active) =>
  `absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface text-ink-2 hover:border-accent hover:text-accent'
  }`

// The body map: tap an area to select it, tap it again to clear it.
function BodyMap({ painAreas, onToggle }) {
  return (
    <div className="relative mx-auto aspect-[1/2] w-full max-w-[220px]">
      <BodySilhouette />
      {PAIN_AREAS.map((area) => (
        <button
          key={area}
          type="button"
          onClick={() => onToggle(area)}
          aria-pressed={painAreas.includes(area)}
          className={`${areaButton(painAreas.includes(area))} ${AREA_POSITIONS[area]}`}
        >
          {areaLabel(area)}
        </button>
      ))}
    </div>
  )
}

// The body map and the starting flexibility. One form, one Save button.
function BodyAndFlexibility() {
  const { data } = useFetch('/profile')

  // Remount the form once the saved values arrive, so it starts from them.
  return <BodyAndFlexibilityForm key={data?.user?.id ?? 'loading'} profile={data?.user} />
}

function BodyAndFlexibilityForm({ profile }) {
  const { setUser } = useAuth()
  const measurements = Object.fromEntries(
    (profile?.baseline?.measurements ?? [])
      .filter((measurement) => TESTS.some((test) => test.id === measurement.test))
      .map((measurement) => [measurement.test, measurement.value]),
  )
  const { bind, errors, processing, submit } = useForm({
    sit_and_reach: measurements.sit_and_reach ?? '',
    neck_range: measurements.neck_range ?? '',
    shoulder_range: measurements.shoulder_range ?? '',
  })
  const [painAreas, setPainAreas] = useState(() => profile?.painAreas ?? [])
  const [savedAt, setSavedAt] = useState(0)

  const toggle = (area) =>
    setPainAreas((current) => (current.includes(area) ? current.filter((value) => value !== area) : [...current, area]))

  const save = (event) => {
    event.preventDefault()
    submit(async (formValues) => {
      const measurements = TESTS.filter((test) => formValues[test.id] !== '')
        .map((test) => ({ test: test.id, value: Number(formValues[test.id]), unit: test.unit }))

      const { user } = await api.put('/profile', {
        painAreas,
        baseline: {
          assessedAt: measurements.length > 0 ? new Date().toISOString() : null,
          measurements,
        },
      })

      // Keep the rest of the app in step with the new body map.
      setUser(user)
      setSavedAt(Date.now())
    })
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section id="body" className={`${card} scroll-mt-8 overflow-hidden p-5 sm:p-6`}>
        <SectionHeader title="Body map">
          Tap the areas where you feel pain. We use them to put the stretches that help you first in the library.
        </SectionHeader>
        <BodyMap painAreas={painAreas} onToggle={toggle} />
      </section>

      <section id="flexibility" className={`${card} scroll-mt-8 overflow-hidden p-5 sm:p-6`}>
        <SectionHeader title="Starting flexibility">
          Your starting point, so later sessions can be compared against it. Leave a field empty if you have not measured it.
        </SectionHeader>

        <div className="grid max-w-2xl gap-5 sm:grid-cols-3">
          {TESTS.map((test) => (
            <div key={test.id}>
              <InputLabel htmlFor={test.id} value={test.label} />
              <div className="relative mt-1.5">
                <TextInput
                  id={test.id}
                  type="number"
                  inputMode="numeric"
                  min={test.min}
                  max={test.max}
                  step={test.min === 1 ? 1 : 'any'}
                  className="pe-12"
                  {...bind(test.id)}
                />
                <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">{test.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-4">
        <PrimaryButton disabled={processing}>Save</PrimaryButton>
        {savedAt > 0 && <SavedNote key={savedAt} />}
      </div>
      <InputError messages={errors._form} className="mt-2" />
    </form>
  )
}

function ProfileInformation() {
  const { user, setUser } = useAuth()
  const form = useForm({ name: user.name })
  const [savedAt, setSavedAt] = useState(0)

  const submit = (event) => {
    event.preventDefault()
    form.submit(async (values) => {
      const { user: updated } = await api.patch('/profile', values)
      setUser(updated)
      setSavedAt(Date.now())
    })
  }

  return (
    <section id="profile" className={`${card} scroll-mt-8 overflow-hidden p-5 sm:p-6`}>
      <SectionHeader title="Your name">This is the name shown in the menu and on exercises you add.</SectionHeader>

      <form onSubmit={submit} className="max-w-xl space-y-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent-soft font-mono text-base font-medium text-accent-dark">
            {initials(form.values.name || user.name)}
          </span>
          <p className="text-sm text-muted">Your initials appear in the menu and on exercises you add.</p>
        </div>

        <div>
          <InputLabel htmlFor="name" value="Name" />
          <TextInput id="name" type="text" className="mt-1.5" required autoComplete="name" {...form.bind('name')} />
          <InputError className="mt-2" messages={form.errors.name} />
        </div>

        <InputError messages={form.errors._form} />

        <div className="flex items-center gap-4">
          <PrimaryButton disabled={form.processing}>Save</PrimaryButton>
          {savedAt > 0 && <SavedNote key={savedAt} />}
        </div>
      </form>
    </section>
  )
}

function EmailAddress() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const form = useForm({ email: '', currentPassword: '' })

  const submit = (event) => {
    event.preventDefault()
    form.submit(async (values) => {
      const result = await api.put('/profile/email', values)
      setUser(null)
      navigate('/login', { state: { flash: result.message } })
    })
  }

  return (
    <section id="email" className={`${card} scroll-mt-8 overflow-hidden p-5 sm:p-6`}>
      <SectionHeader title="Email address">
        Changing your email signs you out everywhere. You will verify the new address the next time you log in.
      </SectionHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-ink">{user.email}</span>
        <span className={user.emailVerifiedAt ? 'rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-dark' : 'rounded bg-caution-soft px-1.5 py-0.5 text-[11px] font-medium text-caution'}>
          {user.emailVerifiedAt ? 'Verified' : 'Not verified'}
        </span>
      </div>

      <form onSubmit={submit} className="max-w-xl space-y-5">
        <div>
          <InputLabel htmlFor="new_email" value="New email" />
          <TextInput
            id="new_email"
            type="email"
            className="mt-1.5"
            required
            autoComplete="email"
            placeholder="you@example.com"
            {...form.bind('email')}
          />
          <InputError className="mt-2" messages={form.errors.email} />
        </div>

        <div>
          <InputLabel htmlFor="email_current_password" value="Current password" />
          <TextInput
            id="email_current_password"
            type="password"
            className="mt-1.5"
            required
            autoComplete="current-password"
            {...form.bind('currentPassword')}
          />
          <InputError className="mt-2" messages={form.errors.currentPassword} />
        </div>

        <InputError messages={form.errors._form} />

        <PrimaryButton disabled={form.processing}>Update email</PrimaryButton>
      </form>
    </section>
  )
}

function UpdatePassword() {
  const form = useForm({ currentPassword: '', password: '', passwordConfirmation: '' })
  const [savedAt, setSavedAt] = useState(0)

  const submit = (event) => {
    event.preventDefault()
    form.submit(async (values) => {
      await api.put('/profile/password', values)
      form.setValues({ currentPassword: '', password: '', passwordConfirmation: '' })
      setSavedAt(Date.now())
    })
  }

  return (
    <section id="password" className={`${card} scroll-mt-8 overflow-hidden p-5 sm:p-6`}>
      <SectionHeader title="Password">
        Use a password you don&apos;t use anywhere else. Changing it signs out your other sessions.
      </SectionHeader>

      <form onSubmit={submit} className="max-w-xl space-y-5">
        <div>
          <InputLabel htmlFor="update_password_current_password" value="Current password" />
          <TextInput
            id="update_password_current_password"
            type="password"
            className="mt-1.5"
            autoComplete="current-password"
            {...form.bind('currentPassword')}
          />
          <InputError messages={form.errors.currentPassword} className="mt-2" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <InputLabel htmlFor="update_password_password" value="New password" />
            <TextInput
              id="update_password_password"
              type="password"
              className="mt-1.5"
              autoComplete="new-password"
              aria-describedby="update_password_rules"
              {...form.bind('password')}
            />
            <InputError messages={form.errors.password} className="mt-2" />
          </div>

          <div>
            <InputLabel htmlFor="update_password_password_confirmation" value="Confirm new password" />
            <TextInput
              id="update_password_password_confirmation"
              type="password"
              className="mt-1.5"
              autoComplete="new-password"
              {...form.bind('passwordConfirmation')}
            />
            <InputError messages={form.errors.passwordConfirmation} className="mt-2" />
          </div>
        </div>

        <PasswordChecklist id="update_password_rules" value={form.values.password} />

        <InputError messages={form.errors._form} />

        <div className="flex items-center gap-4">
          <PrimaryButton disabled={form.processing}>Update password</PrimaryButton>
          {savedAt > 0 && <SavedNote key={savedAt} />}
        </div>
      </form>
    </section>
  )
}

function Sessions() {
  const { data, error, loading, reload } = useFetch('/auth/sessions')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const revoke = async (id) => {
    setBusy(true)
    setActionError('')
    try {
      await api.delete(`/auth/sessions/${id}`)
      setNotice('Session revoked.')
      reload()
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const revokeOthers = async () => {
    setBusy(true)
    setActionError('')
    try {
      const result = await api.post('/auth/logout-others')
      setNotice(result.count > 0 ? `${result.count} other session${result.count === 1 ? '' : 's'} signed out.` : 'No other sessions are signed in.')
      reload()
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const sessions = data?.data ?? []
  const hasOthers = sessions.some((session) => !session.current)

  return (
    <section id="sessions" className={`${card} scroll-mt-8 overflow-hidden p-5 sm:p-6`}>
      <SectionHeader title="Signed-in sessions">
        These are the browsers currently signed in to your account. Revoke anything you do not recognise.
      </SectionHeader>

      {loading && <p className="text-sm text-muted">Loading sessions…</p>}
      {error && <p className="text-sm text-danger">{error.message}</p>}

      {!loading && !error && (
        <ul className="divide-y divide-line rounded-md border border-line">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-start justify-between gap-4 px-4 py-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {describeSession(session.userAgent)}
                    {session.current && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-dark">This device</span>}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    Last active {timeAgo(session.lastSeenAt)} · {session.ip || 'Unknown address'}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">Signed in {formatDate(session.createdAt)}</p>
                </div>
              </div>
              {!session.current && (
                <button type="button" onClick={() => revoke(session.id)} disabled={busy} className={`${btn.ghost} ${btn.sm}`}>
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <p className="mt-4 text-sm font-medium text-accent" role="status">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {actionError}
        </p>
      )}

      {hasOthers && (
        <div className="mt-5">
          <SecondaryButton onClick={revokeOthers} disabled={busy}>
            Log out other sessions
          </SecondaryButton>
        </div>
      )}
    </section>
  )
}

function DeleteAccount() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const form = useForm({ password: '' })
  const [open, setOpen] = useState(false)

  const close = () => {
    setOpen(false)
    form.setErrors({})
    form.setField('password', '')
  }

  const submit = (event) => {
    event.preventDefault()
    form.submit(async (values) => {
      await api.delete('/profile', values)
      navigate('/')
      setUser(null)
    })
  }

  return (
    <section id="delete" className="scroll-mt-8 overflow-hidden rounded-lg border border-danger-line bg-surface p-5 sm:p-6">
      <SectionHeader title="Delete account" danger>
        This permanently removes your account, your session history and every exercise you added to the library (along with other
        members&apos; sessions on those exercises).
      </SectionHeader>

      <button type="button" onClick={() => setOpen(true)} className={`${btn.dangerOutline} ${btn.md}`}>
        Delete account
      </button>

      <Modal show={open} onClose={close} maxWidth="lg">
        <form onSubmit={submit} className="p-6">
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-ink">Delete your account?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">This cannot be undone. Enter your password to confirm.</p>

          <div className="mt-5">
            <InputLabel htmlFor="delete_password" value="Password" />
            <TextInput id="delete_password" type="password" className="mt-1.5" autoComplete="current-password" {...form.bind('password')} />
            <InputError messages={form.errors.password} className="mt-2" />
            <InputError messages={form.errors._form} className="mt-2" />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <SecondaryButton onClick={close}>Cancel</SecondaryButton>
            <DangerButton disabled={form.processing}>Delete account</DangerButton>
          </div>
        </form>
      </Modal>
    </section>
  )
}

export default function Profile() {
  const header = <h1 className={pageTitle}>Profile</h1>

  return (
    <AppLayout title="Profile" header={header}>
      <div className="grid gap-6 pb-10 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:flex-col">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface hover:text-accent"
                >
                  <Icon name={section.icon} className="h-4 w-4" />
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          <BodyAndFlexibility />
          <ProfileInformation />
          <EmailAddress />
          <UpdatePassword />
          <Sessions />
          <DeleteAccount />
        </div>
      </div>
    </AppLayout>
  )
}
