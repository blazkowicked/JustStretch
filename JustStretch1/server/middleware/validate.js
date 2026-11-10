import { z } from 'zod'
import { PASSWORD_MAX_BYTES, firstFailedPasswordRule, passwordByteLength } from '../shared/passwordRules.js'

// Laravel's TrimStrings + ConvertEmptyStringsToNull middleware, applied to JSON bodies.
const UNTOUCHED = new Set(['password', 'passwordConfirmation', 'currentPassword'])

function normalize(value, key) {
  if (typeof value === 'string') {
    if (UNTOUCHED.has(key)) return value
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value)) return value.map((item) => normalize(item, key))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v, k)]))
  }
  return value
}

export function formatIssues(issues) {
  const errors = {}
  for (const issue of issues) {
    const key = issue.path.join('.') || '_'
    ;(errors[key] ??= []).push(issue.message)
  }
  return errors
}

export function validationError(res, errors) {
  return res.status(422).json({ message: Object.values(errors)[0]?.[0] ?? 'Invalid data.', errors })
}

// validate(schema) parses req.body and replaces it with the validated, normalised data.
export function validate(schema) {
  return (req, res, next) => {
    const input = normalize(req.body && typeof req.body === 'object' ? req.body : {}, '')
    const result = schema.safeParse(input)
    if (!result.success) return validationError(res, formatIssues(result.error.issues))
    req.body = result.data
    next()
  }
}

// ---- Laravel-style rule builders. Messages match Laravel 13's English strings. ----

const missing = (input) => input === undefined || input === null

export const required = (label) => `The ${label} field is required.`

export function stringField(label, { max, optional = false } = {}) {
  let schema = z.string({
    error: (iss) => (missing(iss.input) ? required(label) : `The ${label} field must be a string.`),
  })
  if (max) schema = schema.max(max, { error: `The ${label} field must not be greater than ${max} characters.` })
  return optional ? schema.nullish() : schema
}

export function intField(label, { min, max, optional = false } = {}) {
  const between = `The ${label} field must be between ${min} and ${max}.`
  // Laravel accepts numeric strings for `integer`; JSON forms often send them.
  const schema = z.preprocess(
    (v) => (typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : v),
    z
      .number({ error: (iss) => (missing(iss.input) ? required(label) : `The ${label} field must be an integer.`) })
      .int({ error: `The ${label} field must be an integer.` })
      .min(min, { error: between })
      .max(max, { error: between }),
  )
  return optional ? schema.nullish() : schema
}

// Like intField, but keeps decimals (average angle error, for example).
export function numberField(label, { min, max, optional = false } = {}) {
  const between = `The ${label} field must be between ${min} and ${max}.`
  const schema = z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v),
    z
      .number({ error: (iss) => (missing(iss.input) ? required(label) : `The ${label} field must be a number.`) })
      .min(min, { error: between })
      .max(max, { error: between }),
  )
  return optional ? schema.nullish() : schema
}

export function enumField(label, values) {
  return z.enum(values, {
    error: (iss) => (missing(iss.input) ? required(label) : `The selected ${label} is invalid.`),
  })
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailField(label = 'email') {
  return z
    .string({ error: (iss) => (missing(iss.input) ? required(label) : `The ${label} field must be a string.`) })
    .max(255, { error: `The ${label} field must not be greater than 255 characters.` })
    .refine((v) => EMAIL_PATTERN.test(v), { error: `The ${label} field must be a valid email address.` })
    .transform((v) => v.toLowerCase())
}

// Breeze's Password::defaults(): at least 8 characters, at most 72 UTF-8 bytes (bcrypt's limit).
export function newPasswordField(label = 'password') {
  return z
    .string({ error: (iss) => (missing(iss.input) ? required(label) : `The ${label} field must be a string.`) })
    .superRefine((value, ctx) => {
      // Report only the first broken rule; the form's checklist shows the rest.
      const failed = firstFailedPasswordRule(value)
      if (failed) ctx.addIssue({ code: 'custom', message: `The ${label} field ${failed.message}.` })
    })
    .refine((value) => passwordByteLength(value) <= PASSWORD_MAX_BYTES, {
      error: `The ${label} field must not be greater than ${PASSWORD_MAX_BYTES} bytes.`,
    })
}

// Adds Laravel's `confirmed` rule: error is reported on the password field.
export function withConfirmation(schema, field = 'password', confirmField = 'passwordConfirmation') {
  return schema.superRefine((data, ctx) => {
    if (data[field] !== data[confirmField]) {
      ctx.addIssue({ code: 'custom', path: [field], message: `The ${field} field confirmation does not match.` })
    }
  })
}
