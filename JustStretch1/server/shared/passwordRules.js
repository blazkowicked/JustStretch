// Password rules for new passwords (register, reset, change). The server enforces them;
// the client imports the same list to drive the live checklist, so the two never drift.
// Only new passwords are checked. Logging in with an older, weaker password still works.

// bcrypt ignores everything past 72 bytes.
export const PASSWORD_MAX_BYTES = 72

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', message: 'must be at least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'An uppercase letter', message: 'must contain an uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter', message: 'must contain a lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'A number', message: 'must contain a number', test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'A symbol (like ! @ # ?)', message: 'must contain a symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function passwordByteLength(password) {
  return new TextEncoder().encode(password).length
}

// First rule the password breaks, or null. Same order on the server and in the checklist.
export function firstFailedPasswordRule(password) {
  return PASSWORD_RULES.find((rule) => !rule.test(password)) ?? null
}
