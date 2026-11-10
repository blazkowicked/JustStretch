import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Flash from '../components/Flash.jsx'
import Icon from '../components/Icon.jsx'
import PasswordChecklist from '../components/PasswordChecklist.jsx'
import { Wordmark } from '../components/Mark.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useForm, usePageTitle } from '../lib/hooks.js'
import { btn, card, input, label } from '../lib/ui.js'

// The brand panel slides over the form you are not using. Faster than the old 500ms
// ease-in-out, with an iOS-style drawer curve; reduced-motion users get no slide.
const SLIDE = 'transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none'
const FADE = 'transition-opacity duration-300 motion-reduce:transition-none'

const FieldError = ({ messages }) =>
  messages?.length ? (
    <p className="text-[13px] font-medium text-danger" role="alert">
      {messages[0]}
    </p>
  ) : null

function Field({ id, labelText, hint, error, aside, ...props }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={label}>
          {labelText}
        </label>
        {aside}
      </div>
      <input id={id} className={input} {...props} />
      {hint && !error?.length && <p className="text-[13px] text-muted">{hint}</p>}
      <FieldError messages={error} />
    </div>
  )
}

function PasswordField({ id, ...props }) {
  const [shown, setShown] = useState(false)
  return (
    <Field
      id={id}
      type={shown ? 'text' : 'password'}
      aside={
        <button type="button" onClick={() => setShown((v) => !v)} className="text-[13px] font-medium text-accent hover:text-accent-dark">
          {shown ? 'Hide' : 'Show'}
        </button>
      }
      {...props}
    />
  )
}

// Both forms post to the real API. On success AuthContext holds the user and <GuestOnly>
// sends them on to the page they were after (or the dashboard).
function RegisterForm({ active, onToggle }) {
  const { register } = useAuth()
  const form = useForm({ name: '', email: '', password: '', passwordConfirmation: '' })

  const handleSubmit = (event) => {
    event.preventDefault()
    form.submit((values) => register(values))
  }

  return (
    <div
      className={`${active ? 'flex' : 'hidden'} flex-col justify-center gap-5 px-6 py-10 sm:absolute sm:inset-y-0 sm:right-0 sm:flex sm:w-1/2 sm:px-12 ${FADE} ${
        active ? 'sm:opacity-100' : 'sm:pointer-events-none sm:opacity-0'
      }`}
      inert={!active}
    >
      <div>
        <Wordmark />
        <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.02em]">Create your account</h1>
        <p className="mt-1 text-[15px] text-muted">Free, and it takes under a minute.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id="register_name" labelText="Full name" type="text" autoComplete="name" required {...form.bind('name')} error={form.errors.name} />
        <Field
          id="register_email"
          labelText="Email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          required
          {...form.bind('email')}
          error={form.errors.email}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <PasswordField
            id="register_password"
            labelText="Password"
            autoComplete="new-password"
            aria-describedby="register_password_rules"
            required
            {...form.bind('password')}
            error={form.errors.password}
          />
          <Field
            id="register_password_confirmation"
            labelText="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            {...form.bind('passwordConfirmation')}
            error={form.errors.passwordConfirmation}
          />
        </div>
        <PasswordChecklist id="register_password_rules" value={form.values.password} />
        <FieldError messages={form.errors._form} />
        <button type="submit" disabled={form.processing} className={`${btn.primary} ${btn.lg} w-full`}>
          Create account
        </button>
        <p className="text-center text-[13px] leading-relaxed text-muted">We will email you a 6-digit code to verify your address.</p>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <button type="button" onClick={onToggle} className="font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
          Log in
        </button>
      </p>
    </div>
  )
}

function LoginForm({ active, onToggle }) {
  const { login } = useAuth()
  const form = useForm({ email: '', password: '', remember: false })

  const handleSubmit = (event) => {
    event.preventDefault()
    form.submit((values) => login(values))
  }

  return (
    <div
      className={`${active ? 'flex' : 'hidden'} flex-col justify-center gap-5 px-6 py-10 sm:absolute sm:inset-y-0 sm:left-0 sm:flex sm:w-1/2 sm:px-12 ${FADE} ${
        active ? 'sm:opacity-100' : 'sm:pointer-events-none sm:opacity-0'
      }`}
      inert={!active}
    >
      <div>
        <Wordmark />
        <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.02em]">Log in</h1>
        <p className="mt-1 text-[15px] text-muted">Welcome back. Pick up where you left off.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          id="login_email"
          labelText="Email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          required
          {...form.bind('email')}
          error={form.errors.email}
        />
        <PasswordField
          id="login_password"
          labelText="Password"
          autoComplete="current-password"
          required
          {...form.bind('password')}
          error={form.errors.password}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-field text-accent focus:ring-accent"
              {...form.bindCheckbox('remember')}
            />
            Keep me signed in
          </label>
          <Link to="/forgot-password" className="text-[13px] font-medium text-accent hover:text-accent-dark">
            Forgot password?
          </Link>
        </div>
        <FieldError messages={form.errors._form} />
        <button type="submit" disabled={form.processing} className={`${btn.primary} ${btn.lg} w-full`}>
          Log in
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        New here?{' '}
        <button type="button" onClick={onToggle} className="font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
          Create an account
        </button>
      </p>
    </div>
  )
}

function VerificationCard() {
  const { pendingVerification: pending, verifyEmail, resendVerification, cancelVerification } = useAuth()
  const form = useForm({ code: '' })
  const [cooldown, setCooldown] = useState(pending.resendAfterSeconds ?? 60)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const submit = (event) => {
    event.preventDefault()
    form.submit(({ code }) => verifyEmail(code))
  }

  const resend = async () => {
    setNotice('')
    try {
      const result = await resendVerification()
      setCooldown(result.resendAfterSeconds ?? 60)
      form.setErrors({})
      setNotice('A new code is on its way.')
    } catch (error) {
      setCooldown(error.retryAfterSeconds ?? cooldown)
      form.setErrors({ _form: [error.message] })
    }
  }

  const cancel = async () => {
    await cancelVerification()
  }

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <div className={`${card} w-full max-w-[480px] p-6 sm:p-8`}>
        <Wordmark />
        <span className="mt-8 flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Icon name="mail" className="h-5 w-5" />
        </span>
        <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.02em]">Check your email</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          {pending.source === 'register' ? 'Finish creating your account by entering the code we sent to ' : 'Enter the code we sent to '}
          <span className="font-medium text-ink">{pending.email}</span>.
        </p>

        <form onSubmit={submit} noValidate className="mt-6 space-y-5">
          <div>
            <label htmlFor="verification_code" className={label}>
              Verification code
            </label>
            <input
              id="verification_code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              className={`${input} mt-1.5 h-12 text-center font-mono text-xl tracking-[0.35em]`}
              {...form.bind('code')}
              onChange={(event) => form.setField('code', event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <p className="mt-1.5 text-[13px] text-muted">The code expires in 10 minutes.</p>
            <FieldError messages={form.errors.code} />
          </div>

          {notice && (
            <p className="text-sm font-medium text-accent" role="status">
              {notice}
            </p>
          )}
          <FieldError messages={form.errors._form} />

          <button type="submit" disabled={form.processing || form.values.code.length !== 6} className={`${btn.primary} ${btn.lg} w-full`}>
            Verify email
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0}
            className="text-[13px] font-medium text-accent hover:text-accent-dark disabled:cursor-not-allowed disabled:text-muted"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
          <button type="button" onClick={cancel} className="text-[13px] font-medium text-muted hover:text-ink">
            Use a different account
          </button>
        </div>
      </div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-accent">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back to home
      </Link>
    </section>
  )
}

const BRAND = {
  login: {
    title: 'Your session history is waiting.',
    points: ['Saved sessions and scores', 'Form trend week to week', 'Stretches matched to your body map'],
    switchLabel: 'Create an account',
  },
  register: {
    title: 'Stretch at home, with measured feedback.',
    points: ['Guided stretches with a 3D reference', 'Joint-angle feedback from your webcam', 'Your video never leaves your device'],
    switchLabel: 'I already have an account',
  },
}

// Dark panel with a frame from a reference video. Sits over the inactive form (desktop only).
function BrandPanel({ view, onToggle }) {
  const content = BRAND[view]
  return (
    <div
      className={`absolute inset-y-0 left-0 z-10 hidden w-1/2 bg-ink sm:block ${SLIDE} ${view === 'login' ? 'translate-x-full' : 'translate-x-0'}`}
    >
      <div key={view} className="flex h-full flex-col justify-center gap-6 px-10 text-white">
        <div className="overflow-hidden rounded-md border border-white/15">
          <div className="aspect-[340/200] bg-ink-2">
            <img src="/thumbs/neck_side_tilt.jpg" alt="" className="h-full w-full object-cover" />
          </div>
          <div className="flex items-center justify-between bg-white/5 px-3 py-2">
            <span className="text-[13px] font-medium text-white/60">Form score</span>
            <span className="font-mono text-sm font-medium">86 / 100</span>
          </div>
        </div>
        <h2 className="text-[26px] font-semibold leading-8 tracking-[-0.02em]">{content.title}</h2>
        <ul className="divide-y divide-white/10 border-y border-white/10">
          {content.points.map((point) => (
            <li key={point} className="flex items-center gap-2.5 py-2.5 text-sm text-white/85">
              <Icon name="check" className="h-4 w-4 text-accent-mid" strokeWidth={2.4} />
              {point}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onToggle}
          className="h-10 self-start rounded-md border border-white/40 px-4 text-sm font-medium transition-colors hover:bg-white hover:text-ink"
        >
          {content.switchLabel}
        </button>
      </div>
    </div>
  )
}

// /login and /register share this page; the green panel slides between the two views.
const LoginPage = ({ initialView = 'login' }) => {
  const { pendingVerification } = useAuth()
  const [activeView, setActiveView] = useState(initialView)
  usePageTitle(pendingVerification ? 'Verify your email' : activeView === 'login' ? 'Log in' : 'Sign up')

  const toggleView = () => setActiveView(activeView === 'login' ? 'register' : 'login')

  if (pendingVerification) return <VerificationCard />

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="w-full max-w-[880px] empty:hidden">
        <Flash />
      </div>
      <div className="relative w-full max-w-[880px] overflow-hidden rounded-lg border border-line bg-surface sm:h-[700px]">
        <BrandPanel view={activeView} onToggle={toggleView} />
        <RegisterForm active={activeView === 'register'} onToggle={toggleView} />
        <LoginForm active={activeView === 'login'} onToggle={toggleView} />
      </div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-accent">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back to home
      </Link>
    </section>
  )
}

export default LoginPage
