import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { EmailVerificationChallenge } from '../models/EmailVerificationChallenge.js'
import { PasswordResetToken } from '../models/PasswordResetToken.js'
import { User } from '../models/User.js'
import { UserSession } from '../models/UserSession.js'
import { createMemoryMailer } from '../services/mailer.js'

let mongod
let app
let mailer

before(async () => {
  mongod = await MongoMemoryServer.create()
  const url = mongod.getUri('juststretch-auth-test')
  await mongoose.connect(url)
  mailer = createMemoryMailer()
  app = createApp({ mongoUrl: url, mailer, rateLimits: false })
})

after(async () => {
  await app.locals.sessionStore.close()
  await mailer.close()
  await mongoose.disconnect()
  await mongod.stop()
})

async function register(name, email) {
  const agent = request.agent(app)
  const res = await agent
    .post('/api/auth/register')
    .send({ name, email, password: 'Passw0rd!', passwordConfirmation: 'Passw0rd!' })
  assert.equal(res.status, 201)
  return { agent, res }
}

async function verify(agent, email) {
  const code = mailer.lastCode(email)
  assert.ok(code)
  const res = await agent.post('/api/auth/verify-email').send({ code })
  assert.equal(res.status, 200)
  return res
}

async function signUp(name, email) {
  const { agent } = await register(name, email)
  await verify(agent, email)
  return agent
}

const passwordBody = (password = 'Passw0rd!') => ({
  password,
  passwordConfirmation: password,
})

describe('email verification', () => {
  test('unverified login sends a new code, enforces cooldown, and verifies', async () => {
    const email = 'pending@example.com'
    await register('Pending', email)

    const agent = request.agent(app)
    const login = await agent.post('/api/auth/login').send({ email, password: 'Passw0rd!' })
    assert.equal(login.status, 200)
    assert.equal(login.body.verificationRequired, true)
    assert.equal(login.body.source, 'login')
    assert.match(login.body.email, /^p\*+@example\.com$/)

    const pending = await agent.get('/api/auth/me')
    assert.equal(pending.body.user, null)
    assert.equal(pending.body.verificationRequired, true)

    const cooldown = await agent.post('/api/auth/resend-verification')
    assert.equal(cooldown.status, 429)
    assert.ok(cooldown.body.retryAfterSeconds > 0)

    const challenge = await EmailVerificationChallenge.findOne({ email }).sort({ createdAt: -1 })
    await EmailVerificationChallenge.updateOne({ _id: challenge._id }, { $set: { lastSentAt: new Date(Date.now() - 61_000) } })

    const resent = await agent.post('/api/auth/resend-verification')
    assert.equal(resent.status, 200)

    const code = mailer.lastCode(email)
    const wrong = await agent.post('/api/auth/verify-email').send({ code: '000000' })
    assert.equal(wrong.status, 422)
    assert.deepEqual(wrong.body.errors.code, ['The verification code is incorrect.'])

    const verified = await agent.post('/api/auth/verify-email').send({ code })
    assert.equal(verified.status, 200)
    assert.equal(verified.body.user.email, email)
  })

  test('codes expire and cancel ends the pending session', async () => {
    const email = 'expired@example.com'
    const { agent } = await register('Expired', email)
    await EmailVerificationChallenge.updateOne({ email }, { $set: { expiresAt: new Date(Date.now() - 1000) } })

    const res = await agent.post('/api/auth/verify-email').send({ code: mailer.lastCode(email) })
    assert.equal(res.status, 422)
    assert.deepEqual(res.body.errors.code, ['The verification code has expired. Request a new one.'])

    assert.equal((await agent.post('/api/auth/cancel-verification')).status, 200)
    assert.equal((await agent.get('/api/auth/me')).body.verificationRequired, undefined)
  })

  test('rejects passwords over 72 UTF-8 bytes', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Long', email: 'long@example.com', ...passwordBody('é'.repeat(37)) })
    assert.equal(res.status, 422)
    assert.ok(res.body.errors.password.some((message) => message.includes('72 bytes')))
  })

  test('rejects new passwords that miss a character rule, one rule at a time', async () => {
    const cases = [
      ['alllowercase1!', 'must contain an uppercase letter'],
      ['ALLUPPERCASE1!', 'must contain a lowercase letter'],
      ['NoNumbersHere!', 'must contain a number'],
      ['NoSymbols123', 'must contain a symbol'],
    ]
    for (const [password, expected] of cases) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Weak', email: 'weak@example.com', ...passwordBody(password) })
      assert.equal(res.status, 422)
      assert.deepEqual(res.body.errors.password, [`The password field ${expected}.`])
    }
  })
})

describe('password reset', () => {
  test('resets the password, verifies the email, and revokes old sessions', async () => {
    const email = 'reset@example.com'
    const agent = await signUp('Reset', email)
    assert.equal((await agent.get('/api/profile')).status, 200)

    const resetter = request.agent(app)
    const requested = await resetter.post('/api/auth/forgot-password').send({ email })
    assert.equal(requested.status, 200)
    assert.match(requested.body.message, /If an account exists/)

    const resetUrl = mailer.lastResetUrl(email)
    const token = new URL(resetUrl).searchParams.get('token')
    const reset = await resetter.post('/api/auth/reset-password').send({ token, ...passwordBody('NewPassw0rd!') })
    assert.equal(reset.status, 200)

    assert.equal((await agent.get('/api/profile')).status, 401)
    assert.equal((await request(app).post('/api/auth/login').send({ email, password: 'Passw0rd!' })).status, 422)
    assert.equal((await request(app).post('/api/auth/login').send({ email, password: 'NewPassw0rd!' })).status, 200)

    const user = await User.findOne({ email })
    assert.ok(user.emailVerifiedAt)
    assert.equal(user.authVersion, 1)
    assert.equal((await PasswordResetToken.countDocuments({ user: user._id, usedAt: null })), 0)

    const reused = await request(app).post('/api/auth/reset-password').send({ token, ...passwordBody('anotherpass') })
    assert.equal(reused.status, 422)
  })

  test('unknown emails get the same response without a reset email', async () => {
    const before = mailer.messages.length
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'missing@example.com' })
    assert.equal(res.status, 200)
    assert.equal(mailer.messages.length, before)
  })
})

describe('account lifecycle', () => {
  test('email change logs out and requires verification on next login', async () => {
    const email = 'old-email@example.com'
    const nextEmail = 'new-email@example.com'
    const agent = await signUp('Email change', email)

    const wrong = await agent.put('/api/profile/email').send({ email: nextEmail, currentPassword: 'wrong-password' })
    assert.equal(wrong.status, 422)

    const changed = await agent.put('/api/profile/email').send({ email: nextEmail, currentPassword: 'Passw0rd!' })
    assert.equal(changed.status, 200)
    assert.equal(changed.body.loggedOut, true)
    assert.equal((await agent.get('/api/profile')).status, 401)

    assert.equal((await request(app).post('/api/auth/login').send({ email, password: 'Passw0rd!' })).status, 422)

    const login = await agent.post('/api/auth/login').send({ email: nextEmail, password: 'Passw0rd!' })
    assert.equal(login.status, 200)
    assert.equal(login.body.verificationRequired, true)

    const verified = await verify(agent, nextEmail)
    assert.equal(verified.body.user.email, nextEmail)
  })

  test('password change keeps the current session and revokes the others', async () => {
    const email = 'password-change@example.com'
    const first = await signUp('Password change', email)
    const second = request.agent(app)
    assert.equal((await second.post('/api/auth/login').send({ email, password: 'Passw0rd!' })).status, 200)
    assert.equal((await second.get('/api/profile')).status, 200)

    const changed = await first
      .put('/api/profile/password')
      .send({ currentPassword: 'Passw0rd!', ...passwordBody('Changed-Pass1') })
    assert.equal(changed.status, 200)

    assert.equal((await first.get('/api/profile')).status, 200)
    assert.equal((await second.get('/api/profile')).status, 401)
    assert.equal((await request(app).post('/api/auth/login').send({ email, password: 'Passw0rd!' })).status, 422)
    assert.equal((await request(app).post('/api/auth/login').send({ email, password: 'Changed-Pass1' })).status, 200)
  })

  test('lists, revokes, and logs out sessions', async () => {
    const email = 'sessions@example.com'
    const first = await signUp('Sessions', email)
    const second = request.agent(app)
    await second.post('/api/auth/login').send({ email, password: 'Passw0rd!' })
    const third = request.agent(app)
    await third.post('/api/auth/login').send({ email, password: 'Passw0rd!' })

    const sessions = await first.get('/api/auth/sessions')
    assert.equal(sessions.status, 200)
    assert.equal(sessions.body.data.length, 3)
    assert.equal(sessions.body.data.filter((item) => item.current).length, 1)

    const other = sessions.body.data.find((item) => !item.current)
    assert.equal((await first.delete(`/api/auth/sessions/${other.id}`)).status, 200)
    assert.equal((await UserSession.countDocuments({ user: (await User.findOne({ email }))._id })), 2)

    const others = await first.post('/api/auth/logout-others')
    assert.equal(others.status, 200)
    assert.equal(others.body.count, 1)
    assert.equal((await first.get('/api/profile')).status, 200)

    assert.equal((await first.post('/api/auth/logout-all')).status, 200)
    assert.equal((await first.get('/api/profile')).status, 401)
  })

  test('deleting an account removes its auth records', async () => {
    const email = 'delete-me@example.com'
    const agent = await signUp('Delete me', email)
    const user = await User.findOne({ email })

    assert.equal((await agent.delete('/api/profile').send({ password: 'wrong-password' })).status, 422)
    assert.equal((await agent.delete('/api/profile').send({ password: 'Passw0rd!' })).status, 200)
    assert.equal(await User.countDocuments({ _id: user._id }), 0)
    assert.equal(await UserSession.countDocuments({ user: user._id }), 0)
    assert.equal(await EmailVerificationChallenge.countDocuments({ user: user._id }), 0)
    assert.equal(await PasswordResetToken.countDocuments({ user: user._id }), 0)
  })
})
