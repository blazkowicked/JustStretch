import { useEffect, useRef, useState } from 'react'
import { PASSWORD_MAX_BYTES, PASSWORD_RULES, passwordByteLength } from '../lib/passwordRules.js'
import Icon from './Icon.jsx'

// Live checklist under a new-password field. It only guides the user while typing;
// the API is what enforces the rules (server/shared/passwordRules.js).
// Give the password input aria-describedby={id} so screen readers link the two.
export default function PasswordChecklist({ id, value = '', className = '' }) {
  const results = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(value) }))
  const tooLong = passwordByteLength(value) > PASSWORD_MAX_BYTES

  // Announce rules as they become met, not the whole list on every keystroke.
  const previous = useRef(results.map((r) => r.met))
  const [announcement, setAnnouncement] = useState('')
  const metKey = results.map((r) => (r.met ? 1 : 0)).join('')
  useEffect(() => {
    const newlyMet = results.filter((r, i) => r.met && !previous.current[i]).map((r) => r.label)
    previous.current = results.map((r) => r.met)
    setAnnouncement(tooLong ? `Password is too long (${PASSWORD_MAX_BYTES} characters max)` : newlyMet.length ? `${newlyMet.join(', ')}: done` : '')
    // results is derived from value; metKey and tooLong capture every change that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metKey, tooLong])

  return (
    <div className={className}>
      <ul id={id} aria-label="Password requirements" className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {results.map((rule) => (
          <li key={rule.id} className={`flex items-center gap-2 text-[13px] ${rule.met ? 'text-accent' : 'text-muted'}`}>
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                rule.met ? 'border-accent bg-accent text-white' : 'border-line-strong'
              }`}
            >
              {rule.met && <Icon name="check" className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span>
              {rule.label}
              <span className="sr-only">{rule.met ? ' (done)' : ' (not done)'}</span>
            </span>
          </li>
        ))}
        {tooLong && (
          <li className="flex items-center gap-2 text-[13px] font-medium text-danger">
            <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-danger">
              <Icon name="x" className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <span>{PASSWORD_MAX_BYTES} characters or fewer</span>
          </li>
        )}
      </ul>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  )
}
