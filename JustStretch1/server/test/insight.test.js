import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { Insight } from '../models/Insight.js'
import { Therapist } from '../models/Therapist.js'
import { createMemoryMailer } from '../services/mailer.js'
import { cleanNarrative, createInsightWriter } from '../services/insightWriter.js'
import { REFERRAL_LOW_SCORE, REFERRAL_RECENT_SESSIONS } from '../shared/referral.js'

let mongod
let app
let mailer

// Stands in for Groq: records what it was asked and answers with `reply`.
const fakeWriter = {
  enabled: true,
  reply: null,
  calls: [],
  async write(facts) {
    this.calls.push(facts)
    return this.reply
  },
  async writeNote(facts) {
    this.calls.push(facts)
    return this.reply
  },
}

before(async () => {
  mongod = await MongoMemoryServer.create()
  const url = mongod.getUri('juststretch-insight-test')
  await mongoose.connect(url)
  mailer = createMemoryMailer()
  app = createApp({ mongoUrl: url, mailer, rateLimits: false, insightWriter: fakeWriter })
  const { seedTherapists } = await import('../src/seed.js')
  if ((await Therapist.countDocuments()) === 0) await seedTherapists()
})

after(async () => {
  await app.locals.sessionStore.close()
  await mailer.close()
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(() => {
  fakeWriter.enabled = true
  fakeWriter.reply = null
  fakeWriter.calls = []
})

async function signUp(name, email) {
  const agent = request.agent(app)
  const res = await agent.post('/api/auth/register').send({ name, email, password: 'Passw0rd!', passwordConfirmation: 'Passw0rd!' })
  assert.equal(res.status, 201)
  const verified = await agent.post('/api/auth/verify-email').send({ code: mailer.lastCode(email) })
  assert.equal(verified.status, 200)
  return agent
}

const exerciseBody = (title, targetArea) => ({
  title,
  targetArea,
  difficulty: 'beginner',
  durationMinutes: 3,
  sets: 1,
  repsPerSet: 1,
  description: 'A stretch.',
  instructions: 'Hold it.',
  benefits: ['Loosens tight muscles'],
  precautions: '',
  videoUrl: '',
})

async function addExercise(agent, title, targetArea) {
  const res = await agent.post('/api/exercises').send(exerciseBody(title, targetArea))
  assert.equal(res.status, 201)
  return res.body.exercise
}

const save = (agent, exercise, score) => agent.post(`/api/exercises/${exercise.id}/sessions`).send({ score, durationSeconds: 60 })

describe('dashboard insight', () => {
  test('no sessions means no narrative', async () => {
    const user = await signUp('Fresh', 'fresh@example.com')
    const res = await user.get('/api/dashboard/insight')
    assert.equal(res.status, 200)
    assert.equal(res.body.narrative, null)
    assert.equal(fakeWriter.calls.length, 0)
  })

  test('finds the best and worst area and the lowest exercise, with a template when Groq is off', async () => {
    fakeWriter.enabled = false
    const user = await signUp('Template', 'template@example.com')
    const neck = await addExercise(user, 'Neck Tilt', 'neck')
    const hip = await addExercise(user, 'Hip Opener', 'hips')
    const hip2 = await addExercise(user, 'Deep Lunge', 'hips')
    await save(user, neck, 90)
    await save(user, neck, 80)
    await save(user, hip, 70)
    await save(user, hip2, 60)

    const { body } = await user.get('/api/dashboard/insight')
    assert.equal(body.bestArea.area, 'neck')
    assert.equal(body.bestArea.score, 85)
    assert.equal(body.worstArea.area, 'hips')
    assert.equal(body.worstArea.score, 65)
    assert.equal(body.lowestExercise.title, 'Deep Lunge')
    assert.equal(body.lowestExercise.score, 60)
    assert.equal(body.referral, null)
    assert.equal(body.source, 'template')
    assert.match(body.narrative, /neck/i)
    assert.match(body.narrative, /hips/i)
    assert.match(body.narrative, /Deep Lunge/)
    assert.doesNotMatch(body.narrative, /therapist/)
  })

  test('uses Groq, sends no personal data, and caches until the sessions change', async () => {
    fakeWriter.reply = 'Your neck work is solid at 90/100. Give **Hip Opener** another go to lift your hips.'
    const user = await signUp('Groq User', 'groq-user@example.com')
    const neck = await addExercise(user, 'Neck Roll', 'neck')
    const hip = await addExercise(user, 'Hip Opener', 'hips')
    await save(user, neck, 90)
    await save(user, hip, 55)

    const first = await user.get('/api/dashboard/insight')
    assert.equal(first.body.source, 'groq')
    // Markdown from the model is stripped before it is stored or shown.
    assert.equal(first.body.narrative, 'Your neck work is solid at 90/100. Give Hip Opener another go to lift your hips.')
    assert.equal(fakeWriter.calls.length, 1)

    const sent = JSON.stringify(fakeWriter.calls[0])
    assert.doesNotMatch(sent, /groq-user@example\.com|Groq User/)
    assert.doesNotMatch(sent, /[0-9a-f]{24}/, 'no database ids')
    assert.equal(fakeWriter.calls[0].areaNeedingMostWork.name, 'Hips')
    assert.equal(fakeWriter.calls[0].lowestScoringExercise.title, 'Hip Opener')

    // Same sessions: served from the cache, Groq is not called again.
    const second = await user.get('/api/dashboard/insight')
    assert.equal(second.body.narrative, first.body.narrative)
    assert.equal(fakeWriter.calls.length, 1)

    // A new session changes the facts, so the narrative is written again.
    fakeWriter.reply = 'Hips are improving.'
    await save(user, hip, 75)
    const third = await user.get('/api/dashboard/insight')
    assert.equal(third.body.narrative, 'Hips are improving.')
    assert.equal(fakeWriter.calls.length, 2)
  })

  test('falls back to the template when Groq does not answer', async () => {
    fakeWriter.reply = null
    const user = await signUp('Offline', 'offline@example.com')
    const neck = await addExercise(user, 'Neck Stretch', 'neck')
    await save(user, neck, 72)

    const { body } = await user.get('/api/dashboard/insight')
    assert.equal(body.source, 'template')
    assert.match(body.narrative, /only practised your neck/i)
    assert.equal(fakeWriter.calls.length, 1)
  })

  test('recommends a professional with contact details when an area keeps scoring low', async () => {
    fakeWriter.enabled = false
    const user = await signUp('Low', 'low@example.com')
    const neck = await addExercise(user, 'Neck Low', 'neck')
    const hip = await addExercise(user, 'Hip Fine', 'hips')
    await save(user, hip, 85)
    for (let i = 0; i < REFERRAL_RECENT_SESSIONS; i += 1) await save(user, neck, REFERRAL_LOW_SCORE - 15)

    const { body } = await user.get('/api/dashboard/insight')
    assert.equal(body.referral.reason, 'low_scores')
    assert.equal(body.referral.area, 'neck')
    assert.ok(body.referral.therapist.phone)
    assert.ok(body.referral.therapist.email)
    assert.match(body.narrative, /physical therapist/)
  })

  test('the insight is removed with the account', async () => {
    fakeWriter.enabled = false
    const user = await signUp('Leaving', 'leaving@example.com')
    const neck = await addExercise(user, 'Neck Bye', 'neck')
    await save(user, neck, 70)
    await user.get('/api/dashboard/insight')
    const me = (await user.get('/api/auth/me')).body.user
    assert.equal(await Insight.countDocuments({ user: me.id }), 1)

    const res = await user.delete('/api/profile').send({ password: 'Passw0rd!' })
    assert.equal(res.status, 200)
    assert.equal(await Insight.countDocuments({ user: me.id }), 0)
  })

  test('guests get 401', async () => {
    const res = await request(app).get('/api/dashboard/insight')
    assert.equal(res.status, 401)
  })
})

describe('insight writer', () => {
  test('is off without a key and never calls out', async () => {
    let called = false
    const writer = createInsightWriter({ apiKey: '', fetchImpl: async () => { called = true } })
    assert.equal(writer.enabled, false)
    assert.equal(await writer.write({}), null)
    assert.equal(called, false)
  })

  test('posts to Groq with the key and returns the cleaned reply', async () => {
    let seen
    const writer = createInsightWriter({
      apiKey: 'gsk_test',
      model: 'llama-3.3-70b-versatile',
      fetchImpl: async (url, init) => {
        seen = { url, init }
        return { ok: true, json: async () => ({ choices: [{ message: { content: '"## Nice work on your **neck**."' } }] }) }
      },
    })
    assert.equal(await writer.write({ bestArea: { name: 'Neck' } }), 'Nice work on your neck.')
    assert.equal(seen.url, 'https://api.groq.com/openai/v1/chat/completions')
    assert.equal(seen.init.headers.Authorization, 'Bearer gsk_test')
    const body = JSON.parse(seen.init.body)
    assert.equal(body.model, 'llama-3.3-70b-versatile')
    assert.equal(body.messages[0].role, 'system')
  })

  test('returns null on an HTTP error or a network failure', async () => {
    const failing = createInsightWriter({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 429 }) })
    assert.equal(await failing.write({}), null)
    const throwing = createInsightWriter({ apiKey: 'k', fetchImpl: async () => { throw new TypeError('fetch failed') } })
    assert.equal(await throwing.write({}), null)
  })

  test('cleanNarrative strips markdown and caps the length', () => {
    assert.equal(cleanNarrative('  **Bold** _text_  '), 'Bold text')
    assert.equal(cleanNarrative(''), null)
    assert.ok(cleanNarrative('a'.repeat(1000)).length <= 400)
  })
})

// Camera results for one session: the left shoulder struggled, the rest held.
const noteMetrics = {
  trackingScore: 64,
  jointResults: [
    { joint: 'left_shoulder', avgError: 21.4, timeInRangePct: 38 },
    { joint: 'right_shoulder', avgError: 6.2, timeInRangePct: 91 },
    { joint: 'neck_tilt', avgError: 9.8, timeInRangePct: 72 },
  ],
  limbResults: [
    { limb: 'leftArm', score: 40, judgedFrames: 300, goodFrames: 120 },
    { limb: 'rightArm', score: 88, judgedFrames: 300, goodFrames: 264 },
    { limb: 'neck', score: 72, judgedFrames: 300, goodFrames: 216 },
  ],
}

describe('session note draft', () => {
  test('writes a template note about what did not stretch properly when Groq is off', async () => {
    fakeWriter.enabled = false
    const user = await signUp('Note Template', 'note-template@example.com')
    const exercise = await addExercise(user, 'Cross-Body Shoulder Stretch', 'shoulders')

    const res = await user.post(`/api/exercises/${exercise.id}/session-note`).send(noteMetrics)
    assert.equal(res.status, 200)
    assert.equal(res.body.source, 'template')
    assert.match(res.body.note, /left shoulder \(in range 38% of the time\)/)
    assert.match(res.body.note, /neck tilt \(in range 72% of the time\)/)
    assert.doesNotMatch(res.body.note, /right shoulder/)
    assert.match(res.body.note, /left arm lagged behind my right \(40 vs 88\)/)
  })

  test('uses Groq with facts only, and saves nothing', async () => {
    fakeWriter.reply = 'My **left shoulder** only stayed in range 38% of the time.'
    const user = await signUp('Note Groq', 'note-groq@example.com')
    const exercise = await addExercise(user, 'Overhead Side Bend', 'shoulders')

    const res = await user.post(`/api/exercises/${exercise.id}/session-note`).send(noteMetrics)
    assert.equal(res.status, 200)
    assert.equal(res.body.source, 'groq')
    assert.equal(res.body.note, 'My left shoulder only stayed in range 38% of the time.')

    const facts = fakeWriter.calls.at(-1)
    assert.equal(facts.exercise, 'Overhead Side Bend')
    assert.deepEqual(facts.needsWork.map((j) => j.joint), ['left shoulder', 'neck tilt'])
    assert.deepEqual(facts.sideGap, { part: 'arm', weakerSide: 'left', weakerScore: 40, strongerScore: 88 })
    assert.doesNotMatch(JSON.stringify(facts), /note-groq@example\.com|Note Groq/)
    assert.equal((await user.get('/api/sessions')).body.meta.total, 0)
  })

  test('returns no note for a session without camera results', async () => {
    const user = await signUp('Note Manual', 'note-manual@example.com')
    const exercise = await addExercise(user, 'Shoulder Rolls', 'shoulders')
    const res = await user.post(`/api/exercises/${exercise.id}/session-note`).send({})
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { note: null, source: null })
    assert.equal(fakeWriter.calls.length, 0)
  })

  test('requires a login', async () => {
    const owner = await signUp('Note Owner', 'note-owner@example.com')
    const exercise = await addExercise(owner, 'Neck Side Tilt', 'neck')
    const res = await request(app).post(`/api/exercises/${exercise.id}/session-note`).send(noteMetrics)
    assert.equal(res.status, 401)
  })
})
