// Port of app/Http/Requests/*. Same rules, same messages.
import { z } from 'zod'
import { BODY_AREA_VALUES, DIFFICULTY_VALUES } from '../shared/enums.js'
import { LIMB_IDS } from '../shared/limbs.js'
import {
  emailField,
  enumField,
  intField,
  newPasswordField,
  numberField,
  required,
  stringField,
  withConfirmation,
} from './validate.js'

// "must be a full link or a path like /videos/stretch.mp4"
export const VIDEO_URL_MESSAGE = 'The video URL must be a full link or a path like /videos/stretch.mp4.'

function isFullUrl(value) {
  try {
    new URL(value)
    return /^[a-z][a-z0-9+.-]*:\/\/.+/i.test(value) || /^(mailto|tel):/i.test(value)
  } catch {
    return false
  }
}

const isLocalPath = (value) => /^\/[A-Za-z0-9_\-./]+$/.test(value)

// The form always posts five benefit inputs; drop the blank ones (trimmed already).
const benefitsField = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((b) => b !== null && b !== undefined && b !== '') : v),
  z
    .array(
      z.string({ error: 'The benefit field must be a string.' }).max(80, {
        error: 'The benefit field must not be greater than 80 characters.',
      }),
      { error: 'Add at least one benefit.' },
    )
    .min(1, { error: 'Add at least one benefit.' })
    .max(5, { error: 'The benefits field must not have more than 5 items.' }),
)

export const exerciseSchema = z.object({
  title: stringField('title', { max: 120 }),
  targetArea: enumField('target area', BODY_AREA_VALUES),
  difficulty: enumField('difficulty', DIFFICULTY_VALUES),
  durationMinutes: intField('duration', { min: 1, max: 30 }),
  sets: intField('sets', { min: 1, max: 20, optional: true }),
  repsPerSet: intField('reps per set', { min: 1, max: 50, optional: true }),
  description: stringField('description', { max: 500 }),
  instructions: stringField('instructions', { max: 2000 }),
  benefits: benefitsField,
  precautions: stringField('precautions', { max: 300, optional: true }),
  videoUrl: stringField('video URL', { max: 255, optional: true }).refine(
    (v) => v === null || v === undefined || isFullUrl(v) || isLocalPath(v),
    { error: VIDEO_URL_MESSAGE },
  ),
})

// One tracked joint: how far off the reference it was on average, and how often
// it stayed inside its margin of error.
const jointResultSchema = z.object({
  joint: z
    .string({ error: 'The joint field must be a string.' })
    .max(40, { error: 'The joint field must not be greater than 40 characters.' }),
  avgError: numberField('average error', { min: 0, max: 180 }),
  timeInRangePct: intField('time in range percentage', { min: 0, max: 100 }),
})

// One limb's share of the session (shared/limbs.js groups the joints into limbs).
// The dashboard's limb filter combines these rows frame-weighted.
const limbResultSchema = z.object({
  limb: enumField('limb', LIMB_IDS),
  score: intField('limb score', { min: 0, max: 100 }),
  judgedFrames: intField('limb judged frames', { min: 0, max: 100000 }),
  goodFrames: intField('limb frames within margin', { min: 0, max: 100000 }),
  secondsInForm: intField('limb seconds in form', { min: 0, max: 7200, optional: true }),
})

// avg / min / max / p95 of one timing, in milliseconds.
const timingStats = z
  .object({
    avg: numberField('average', { min: 0, max: 60000, optional: true }),
    min: numberField('minimum', { min: 0, max: 60000, optional: true }),
    max: numberField('maximum', { min: 0, max: 60000, optional: true }),
    p95: numberField('95th percentile', { min: 0, max: 60000, optional: true }),
  })
  .nullish()

const pct = (label) => numberField(label, { min: 0, max: 100, optional: true })

const perfSchema = z.object({
  frames: intField('perf frames', { min: 0, max: 1000000, optional: true }),
  seconds: numberField('perf seconds', { min: 0, max: 7200, optional: true }),
  fps: numberField('fps', { min: 0, max: 1000, optional: true }),
  latencyMs: timingStats,
  processMs: timingStats,
  droppedPct: pct('dropped percentage'),
  noPosePct: pct('no pose percentage'),
  overBudgetPct: pct('over budget percentage'),
  injectedDelays: intField('injected delays', { min: 0, max: 100000, optional: true }),
  outOfOrderFrames: intField('out of order frames', { min: 0, max: 1000000, optional: true }),
})

// Camera results the "Notes" draft is written from (POST /exercises/:id/session-note).
// The same fields the session is saved with; anything else in the body is ignored.
export const sessionNoteSchema = z.object({
  jointResults: z
    .array(jointResultSchema, { error: 'The joint results field must be an array.' })
    .max(24, { error: 'The joint results field must not have more than 24 items.' })
    .optional(),
  limbResults: z
    .array(limbResultSchema, { error: 'The limb results field must be an array.' })
    .max(LIMB_IDS.length, { error: `The limb results field must not have more than ${LIMB_IDS.length} items.` })
    .optional(),
  trackingScore: intField('tracking score', { min: 0, max: 100, optional: true }),
  fatigue: intField('fatigue', { min: 1, max: 5, optional: true }),
})

export const sessionSchema = z
  .object({
    score: intField('score', { min: 0, max: 100 }),
    durationSeconds: intField('duration seconds', { min: 0, max: 7200, optional: true }),
    notes: stringField('notes', { max: 500, optional: true }),
    // Makes an automatic save idempotent: the same workout is only stored once.
    clientId: stringField('client id', { max: 64, optional: true }),
    // Tracking results from the camera. Optional: a stretch without a reference
    // pose is scored by hand and has no joint data.
    jointResults: z
      .array(jointResultSchema, { error: 'The joint results field must be an array.' })
      .max(24, { error: 'The joint results field must not have more than 24 items.' })
      .optional(),
    // Per-limb aggregates from the same frames. Optional: a stretch without a
    // reference pose (or an old session) has none.
    limbResults: z
      .array(limbResultSchema, { error: 'The limb results field must be an array.' })
      .max(LIMB_IDS.length, { error: `The limb results field must not have more than ${LIMB_IDS.length} items.` })
      .optional(),
    judgedFrames: intField('judged frames', { min: 0, max: 100000, optional: true }),
    framesWithinMargin: intField('frames within margin', { min: 0, max: 100000, optional: true }),
    trackingScore: intField('tracking score', { min: 0, max: 100, optional: true }),
    droppedFrames: intField('dropped frames', { min: 0, max: 100000, optional: true }),
    fatigue: intField('fatigue', { min: 1, max: 5, optional: true }),
    // Performance numbers from perfMonitor.js, sent only in ?perf mode.
    perf: perfSchema.nullish(),
  })
  .superRefine((data, ctx) => {
    // Frames within the margin are a subset of the judged frames.
    if (data.framesWithinMargin != null && data.judgedFrames != null && data.framesWithinMargin > data.judgedFrames) {
      ctx.addIssue({
        code: 'custom',
        path: ['framesWithinMargin'],
        message: 'The frames within margin field cannot be greater than the judged frames field.',
      })
    }

    // The same two rules hold per limb, and a limb may appear only once.
    for (const [index, limbResult] of (data.limbResults ?? []).entries()) {
      if (limbResult.goodFrames > limbResult.judgedFrames) {
        ctx.addIssue({
          code: 'custom',
          path: ['limbResults', index, 'goodFrames'],
          message: 'The limb frames within margin field cannot be greater than the limb judged frames field.',
        })
      }
    }
    const limbs = (data.limbResults ?? []).map((limbResult) => limbResult.limb)
    if (new Set(limbs).size !== limbs.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['limbResults'],
        message: 'The limb results field contains a duplicate limb.',
      })
    }
  })

// The dashboard's limb filter: ?limbs=leftArm,rightLeg. Query strings only carry
// strings, so the comma-separated value is split into an array first. Unknown ids
// are rejected with 422, like any other validation failure.
export const dashboardQuerySchema = z.object({
  limbs: z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').map((id) => id.trim()).filter(Boolean) : value),
    z
      .array(enumField('limb', LIMB_IDS), { error: 'The limbs field must be an array.' })
      .max(LIMB_IDS.length, { error: `The limbs field must not have more than ${LIMB_IDS.length} items.` })
      .optional(),
  ),
})

// Editing a saved session (e.g. adding notes after an automatic save).
export const sessionUpdateSchema = z.object({
  score: intField('score', { min: 0, max: 100, optional: true }),
  notes: stringField('notes', { max: 500, optional: true }),
  fatigue: intField('fatigue', { min: 1, max: 5, optional: true }),
})

export const registerSchema = withConfirmation(
  z.object({
    name: stringField('name', { max: 255 }),
    email: emailField(),
    password: newPasswordField(),
    passwordConfirmation: z.string().nullish(),
  }),
)

export const loginSchema = z.object({
  email: emailField(),
  password: stringField('password'),
  remember: z.boolean().optional(),
})

export const profileSchema = z.object({
  name: stringField('name', { max: 255 }),
})

export const emailChangeSchema = z.object({
  currentPassword: stringField('current password'),
  email: emailField('email'),
})

export const verifyEmailSchema = z.object({
  code: z
    .string({ error: 'The verification code field is required.' })
    .regex(/^\d{6}$/, { error: 'The verification code must be 6 digits.' }),
})

export const forgotPasswordSchema = z.object({
  email: emailField(),
})

export const resetPasswordSchema = withConfirmation(
  z.object({
    token: z
      .string({ error: 'The reset token field is required.' })
      .regex(/^[a-f0-9]{64}$/i, { error: 'This password reset link is invalid or has expired.' }),
    password: newPasswordField(),
    passwordConfirmation: z.string().nullish(),
  }),
)

// The two flexibility tests that are scored from 1 to 5.
const RANGE_TESTS = ['neck_range', 'shoulder_range']

// One flexibility measurement: which test, the number and the unit.
const measurementSchema = z.object({
  test: z
    .string({ error: 'The test field must be a string.' })
    .max(40, { error: 'The test field must not be greater than 40 characters.' }),
  value: numberField('value', { min: 0, max: 1000 }),
  unit: z
    .string({ error: 'The unit field must be a string.' })
    .max(20, { error: 'The unit field must not be greater than 20 characters.' }),
})

// The body map and the starting flexibility. Nothing else about the account
// can be changed through this route.
export const bodyMapSchema = z
  .object({
    painAreas: z
      .array(enumField('pain area', BODY_AREA_VALUES), { error: 'The pain areas field must be an array.' })
      .max(10, { error: 'The pain areas field must not have more than 10 items.' })
      .optional(),
    baseline: z
      .object({
        assessedAt: z.preprocess(
          (v) => (v === '' || v === null || v === undefined ? undefined : new Date(v)),
          z.date({ error: 'The assessed at field must be a date.' }).nullish(),
        ),
        measurements: z.array(measurementSchema, { error: 'The measurements field must be an array.' }).max(10).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    // The two range tests are scored from 1 to 5.
    for (const [index, measurement] of (data.baseline?.measurements ?? []).entries()) {
      if (!RANGE_TESTS.includes(measurement.test)) continue
      if (!Number.isInteger(measurement.value) || measurement.value < 1 || measurement.value > 5) {
        ctx.addIssue({
          code: 'custom',
          path: ['baseline', 'measurements', index, 'value'],
          message: `The ${measurement.test.replace(/_/g, ' ')} must be a whole number between 1 and 5.`,
        })
      }
    }
  })

export const passwordSchema = withConfirmation(
  z.object({
    currentPassword: stringField('current password'),
    password: newPasswordField(),
    passwordConfirmation: z.string().nullish(),
  }),
)

export const deleteAccountSchema = z.object({
  password: stringField('password'),
})

export { required }
