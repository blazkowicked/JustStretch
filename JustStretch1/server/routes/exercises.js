import { Router } from 'express'
import { deleteExercise } from '../models/cascade.js'
import { Exercise } from '../models/Exercise.js'
import { StretchSession } from '../models/StretchSession.js'
import { forbidden, isValidId, notFound } from '../middleware/errors.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { exerciseSchema, sessionNoteSchema, sessionSchema } from '../middleware/schemas.js'
import { validate } from '../middleware/validate.js'
import { cleanNarrative } from '../services/insightWriter.js'
import { evaluateReferral } from '../services/referral.js'
import { sessionNoteFacts, templateSessionNote } from '../services/sessionNote.js'

const router = Router()
router.use(requireAuth)

const PER_PAGE = 9
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const asString = (v) => (typeof v === 'string' ? v.trim() : '')
const asPage = (v) => Math.max(1, Number.parseInt(v, 10) || 1)

const withAuthor = (query) => query.populate('author', 'name')

async function loadExercise(req, res, next) {
  if (!isValidId(req.params.id)) return notFound(res)
  const exercise = await withAuthor(Exercise.findById(req.params.id))
  if (!exercise) return notFound(res)
  req.exercise = exercise
  next()
}

// Only the member who added an exercise may change or remove it (ExercisePolicy).
function authorOnly(req, res, next) {
  if (String(req.exercise.author._id) !== String(req.user._id)) return forbidden(res)
  next()
}

router.get('/', async (req, res) => {
  const search = asString(req.query.search)
  const area = asString(req.query.area)
  const difficulty = asString(req.query.difficulty)
  const page = asPage(req.query.page)

  // Search and difficulty narrow the area chip counts; the area itself does not,
  // so every chip shows how many results picking it would give.
  const base = {}
  if (search) base.title = { $regex: escapeRegex(search), $options: 'i' }
  if (difficulty) base.difficulty = difficulty
  const filter = area ? { ...base, targetArea: area } : base

  const [total, data, byArea] = await Promise.all([
    Exercise.countDocuments(filter),
    withAuthor(
      Exercise.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * PER_PAGE)
        .limit(PER_PAGE),
    ),
    Exercise.aggregate([{ $match: base }, { $group: { _id: '$targetArea', total: { $sum: 1 } } }]),
  ])
  const areaCounts = Object.fromEntries(byArea.map((a) => [a._id, a.total]))

  res.json({ data, meta: { page, lastPage: Math.max(1, Math.ceil(total / PER_PAGE)), total, areaCounts } })
})

router.post('/', validate(exerciseSchema), async (req, res) => {
  const exercise = await Exercise.create({
    ...req.body,
    sets: req.body.sets ?? 1,
    repsPerSet: req.body.repsPerSet ?? 1,
    author: req.user._id,
  })
  await exercise.populate('author', 'name')
  res.status(201).json({ exercise })
})

router.get('/:id', loadExercise, async (req, res) => {
  const mine = { user: req.user._id, exercise: req.exercise._id }
  const [recentSessions, totals] = await Promise.all([
    StretchSession.find(mine).sort({ completedAt: -1 }).limit(5),
    StretchSession.aggregate([
      { $match: mine },
      { $group: { _id: null, attempts: { $sum: 1 }, best: { $max: '$score' }, avg: { $avg: '$score' } } },
    ]),
  ])
  const stats = totals[0]
    ? { attempts: totals[0].attempts, best: totals[0].best, averageScore: Math.round(totals[0].avg) }
    : { attempts: 0, best: null, averageScore: null }

  res.json({ exercise: req.exercise, recentSessions, stats })
})

// Authorisation runs before validation, like UpdateExerciseRequest::authorize().
router.put('/:id', loadExercise, authorOnly, validate(exerciseSchema), async (req, res) => {
  req.exercise.set({
    ...req.body,
    sets: req.body.sets ?? req.exercise.sets,
    repsPerSet: req.body.repsPerSet ?? req.exercise.repsPerSet,
  })
  await req.exercise.save()
  res.json({ exercise: req.exercise })
})

router.delete('/:id', loadExercise, authorOnly, async (req, res) => {
  await deleteExercise(req.exercise._id)
  res.json({ ok: true, title: req.exercise.title })
})

// Drafts the Notes box from the camera results of the session just finished. Nothing is
// saved here; the member edits the draft and it is stored with the session as usual.
const sessionNoteLimit = (req, res, next) => req.app.locals.rateLimits.sessionNote(req, res, next)

router.post('/:id/session-note', sessionNoteLimit, loadExercise, validate(sessionNoteSchema), async (req, res) => {
  const facts = sessionNoteFacts(req.exercise, req.body)
  if (!facts) return res.json({ note: null, source: null })

  const written = cleanNarrative(await req.app.locals.insightWriter?.writeNote?.(facts))
  res.json(written ? { note: written, source: 'groq' } : { note: templateSessionNote(facts), source: 'template' })
})

router.post('/:id/sessions', loadExercise, validate(sessionSchema), async (req, res) => {
  const clientId = req.body.clientId ?? null

  // An automatic save and a manual retry for the same workout share a clientId,
  // so the second request returns the first row instead of duplicating it.
  if (clientId) {
    const existing = await StretchSession.findOne({ user: req.user._id, clientId })
    if (existing) {
      return res.status(200).json({
        session: existing,
        message: `Session saved for "${req.exercise.title}". Nice work!`,
      })
    }
  }

  const fields = {
    user: req.user._id,
    exercise: req.exercise._id,
    score: req.body.score,
    durationSeconds: req.body.durationSeconds ?? null,
    notes: req.body.notes ?? null,
    clientId,
    jointResults: req.body.jointResults ?? [],
    limbResults: req.body.limbResults ?? [],
    judgedFrames: req.body.judgedFrames ?? null,
    framesWithinMargin: req.body.framesWithinMargin ?? null,
    trackingScore: req.body.trackingScore ?? null,
    droppedFrames: req.body.droppedFrames ?? null,
    fatigue: req.body.fatigue ?? null,
    perf: req.body.perf ?? null,
    completedAt: new Date(),
  }

  let session
  try {
    session = await StretchSession.create(fields)
  } catch (error) {
    // A concurrent request may have created the row first; return it.
    if (error?.code === 11000 && clientId) {
      session = await StretchSession.findOne({ user: req.user._id, clientId })
    } else {
      throw error
    }
  }

  // Compare the member's recent sessions in this body area with the referral
  // threshold. When it is met, the response carries a therapist's contact details.
  const referral = await evaluateReferral(session, req.exercise)

  res.status(201).json({
    session,
    referral,
    message: referral
      ? `Session saved for "${req.exercise.title}". We recommend having a physical therapist look at this area.`
      : `Session saved for "${req.exercise.title}". Nice work!`,
  })
})

export default router
