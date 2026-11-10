import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

const FIFTEEN_MINUTES = 15 * 60 * 1000
const HOUR = 60 * 60 * 1000

function emailKey(req) {
  return String(req.body?.email ?? req.session?.pendingVerification?.email ?? '')
    .trim()
    .toLowerCase()
}

function requestKey(req) {
  return `${ipKeyGenerator(req.ip ?? '')}:${emailKey(req)}`
}

function userKey(req) {
  return String(req.user?._id ?? ipKeyGenerator(req.ip ?? ''))
}

function limiter(limit, windowMs, keyGenerator = requestKey) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => res.status(429).json({ message: 'Too many attempts. Please try again later.' }),
  })
}

const noLimit = (_req, _res, next) => next()

export function createRateLimiters({ enabled = true } = {}) {
  if (!enabled) {
    return {
      login: noLimit,
      register: noLimit,
      forgotPassword: noLimit,
      resetPassword: noLimit,
      verifyEmail: noLimit,
      resendVerification: noLimit,
      sensitive: noLimit,
      sessionNote: noLimit,
    }
  }

  return {
    login: limiter(10, FIFTEEN_MINUTES),
    register: limiter(5, HOUR),
    forgotPassword: limiter(5, HOUR),
    resetPassword: limiter(10, HOUR),
    verifyEmail: limiter(10, FIFTEEN_MINUTES),
    resendVerification: limiter(3, FIFTEEN_MINUTES),
    sensitive: limiter(5, FIFTEEN_MINUTES, userKey),
    // Each note draft is one Groq call.
    sessionNote: limiter(20, FIFTEEN_MINUTES, userKey),
  }
}
