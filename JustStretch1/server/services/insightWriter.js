// Writes the dashboard's narrative recommendation with Groq.
//
// The server decides every fact first (services/insight.js): the best and worst body
// area, the lowest-scoring exercise and whether a referral applies. Groq only turns
// those facts into one or two friendly sentences. It never sees the member's name or
// email, and it cannot change a score or decide a referral on its own.
//
// Without GROQ_API_KEY (or when Groq fails) write() resolves to null and the caller
// uses the plain template from insight.js instead.
//
// writeNote() drafts the session's Notes box the same way: the facts come from
// services/sessionNote.js and Groq only words them. It falls back to that file's template.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const TIMEOUT_MS = 8000
const MAX_CHARS = 400

const SYSTEM_PROMPT = [
  'You write a short progress note for the dashboard of Just Stretch, a stretching app that scores form with a webcam.',
  'You receive facts as JSON. Use only those facts. Never invent scores, body areas, exercises or advice that is not supported by them.',
  'Write one or two sentences, at most 55 words, in plain text: no markdown, no lists, no emojis, no greeting, no quotation marks.',
  'Speak to the member as "you". Be encouraging and specific.',
  'Mention the best area and the area that needs the most work with their scores. If they are the same area, say they have only practised that area so far and suggest trying another one.',
  'Suggest repeating the lowest-scoring exercise by its exact title to improve it.',
  'Scores are form scores out of 100 from the camera, not medical measurements. Do not diagnose or name injuries or conditions.',
  'If "referral" is not null, end with one calm sentence saying their recent scores for that area suggest checking in with a physical therapist, whose contact details are shown below. Do not say this when "referral" is null.',
].join('\n')

const NOTE_PROMPT = [
  'You draft the notes a member saves after one stretching session in Just Stretch, an app that scores form with a webcam.',
  'You receive facts as JSON about the session they just finished. Use only those facts. Never invent joints, limbs, numbers or advice.',
  'Write in the first person, as the member jotting down their own note (for example "My left shoulder...").',
  'Write one or two sentences, at most 45 words, in plain text: no markdown, no lists, no emojis, no greeting, no quotation marks.',
  'Focus on what did not stretch properly: name the joints in "needsWork" and how much of the time each stayed in range.',
  'If "sideGap" is not null, say which side lagged behind the other, with both scores.',
  'If "needsWork" is empty, say the form held well and name one or two joints from "heldWell".',
  'If "fatigue" is 4 or 5, you may add that the session felt tiring. Otherwise do not mention fatigue.',
  'These are form scores from the camera, not medical measurements. Do not give advice, diagnose, or mention pain, injuries or conditions.',
].join('\n')

// Model output is shown as plain text, so strip anything that would look odd in a sentence.
export function cleanNarrative(text) {
  const cleaned = String(text ?? '')
    .replace(/[*_#`>]/g, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  return cleaned.length > MAX_CHARS ? `${cleaned.slice(0, MAX_CHARS - 1).trimEnd()}…` : cleaned
}

export function createInsightWriter({ apiKey = '', model = 'openai/gpt-oss-20b', fetchImpl = globalThis.fetch } = {}) {
  const enabled = Boolean(apiKey)

  // One chat completion with `systemPrompt`; resolves to cleaned text or null.
  async function complete(systemPrompt, facts) {
    if (!enabled) return null
    try {
      const payload = {
        model,
        temperature: 0.4,
        max_completion_tokens: 200,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(facts) },
        ],
      }
      // gpt-oss models think first; keep it short and leave the thinking out of the reply.
      // The thinking counts toward the token limit, so give these models more room or the
      // reply can come back empty.
      if (model.startsWith('openai/gpt-oss-')) {
        payload.reasoning_effort = 'low'
        payload.include_reasoning = false
        payload.max_completion_tokens = 1024
      }

      const res = await fetchImpl(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) {
        // Groq's own error code and message help with a wrong key or model name. Never the
        // member's data, and any key-shaped text is scrubbed out first.
        const error = await (async () => (await res.json())?.error ?? {})().catch(() => ({}))
        const detail = String(error.message ?? '')
          .replace(/gsk_[A-Za-z0-9]+/g, '[redacted]')
          .slice(0, 200)
        console.warn(`[insight] Groq request failed with status ${res.status} (${error.code ?? 'no code'}): ${detail}`)
        return null
      }
      const data = await res.json()
      return cleanNarrative(data?.choices?.[0]?.message?.content)
    } catch (error) {
      console.warn(`[insight] Groq request failed: ${error.name}`)
      return null
    }
  }

  const write = (facts) => complete(SYSTEM_PROMPT, facts)
  const writeNote = (facts) => complete(NOTE_PROMPT, facts)

  return { enabled, model, write, writeNote }
}
