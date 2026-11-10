import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { InputError, InputLabel, PrimaryButton, TextInput } from '../components/forms.jsx'
import Icon from '../components/Icon.jsx'
import PasswordChecklist from '../components/PasswordChecklist.jsx'
import { Wordmark } from '../components/Mark.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { useForm, usePageTitle } from '../lib/hooks.js'
import { card, link } from '../lib/ui.js'

function tokenFromUrl() {
  return new URLSearchParams(window.location.search).get('token')
}

export default function ResetPassword() {
  usePageTitle('Choose a new password')
  const { clearAuth } = useAuth()
  const [token] = useState(tokenFromUrl)
  const [done, setDone] = useState(false)
  const form = useForm({ password: '', passwordConfirmation: '' })

  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname)
  }, [token])

  const submit = (event) => {
    event.preventDefault()
    form.submit(async (values) => {
      await api.post('/auth/reset-password', { token, ...values })
      clearAuth()
      setDone(true)
    })
  }

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <div className={`${card} w-full max-w-[440px] p-6 sm:p-8`}>
        <Wordmark />

        {!token ? (
          <>
            <span className="mt-8 flex h-11 w-11 items-center justify-center rounded-md bg-danger-soft text-danger">
              <Icon name="warn" className="h-5 w-5" />
            </span>
            <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.02em]">Link not valid</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              This reset link is missing or incomplete. Request a new one to continue.
            </p>
            <Link to="/forgot-password" className={`${link} mt-6 inline-block text-sm`}>
              Request a new link
            </Link>
          </>
        ) : done ? (
          <>
            <span className="mt-8 flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
              <Icon name="check" className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.02em]">Password updated</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Your password has been changed and other sessions have been signed out. Log in with your new password.
            </p>
            <Link to="/login" className={`${link} mt-6 inline-block text-sm`}>
              Log in
            </Link>
          </>
        ) : (
          <>
            <span className="mt-8 flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
              <Icon name="key" className="h-5 w-5" />
            </span>
            <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.02em]">Choose a new password</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Pick a password that meets the requirements below. Resetting your password also confirms your email address.
            </p>

            <form onSubmit={submit} noValidate className="mt-6 space-y-5">
              <div>
                <InputLabel htmlFor="reset_password" value="New password" />
                <TextInput
                  id="reset_password"
                  type="password"
                  className="mt-1.5"
                  autoComplete="new-password"
                  aria-describedby="reset_password_rules"
                  required
                  autoFocus
                  {...form.bind('password')}
                />
                <InputError messages={form.errors.password} className="mt-2" />
                <PasswordChecklist id="reset_password_rules" value={form.values.password} className="mt-3" />
              </div>

              <div>
                <InputLabel htmlFor="reset_password_confirmation" value="Confirm new password" />
                <TextInput
                  id="reset_password_confirmation"
                  type="password"
                  className="mt-1.5"
                  autoComplete="new-password"
                  required
                  {...form.bind('passwordConfirmation')}
                />
                <InputError messages={form.errors.passwordConfirmation} className="mt-2" />
              </div>

              <InputError messages={form.errors.token} />
              <InputError messages={form.errors._form} />
              <PrimaryButton className="w-full" size="lg" disabled={form.processing}>
                Update password
              </PrimaryButton>
            </form>

            <Link to="/login" className={`${link} mt-5 inline-block text-sm`}>
              Back to log in
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
