// Draft for the "Notes" box after a session.
//
// Same split as the dashboard summary (services/insight.js): the facts are decided here,
// in code, from the camera results the member just produced. Which joints were out of
// range, which limb lagged, how the two sides compare. Groq only turns those facts into
// a short first-person note (services/insightWriter.js, writeNote). When Groq is off or
// fails, templateSessionNote() writes it instead. The member can edit or clear the
// draft before saving; nothing is stored until they press Save or Update.
import { areaLabel } from '../shared/enums.js'
import { LIMB_BY_JOINT, limbLabel } from '../shared/limbs.js'

// A joint "held the stretch" when it stayed in range at least this share of the time.
// Same threshold the results table uses to colour a row green or red.
export const IN_RANGE_GOAL_PCT = 80
// Left and right limb scores this far apart count as one side lagging.
export const SIDE_GAP_POINTS = 15
const MAX_LISTED = 3

const jointName = (joint) => String(joint).replace(/_/g, ' ')

function sideGap(limbs) {
  const byId = new Map(limbs.map((l) => [l.limb, l.score]))
  const gaps = []
  for (const part of ['Arm', 'Leg']) {
    const left = byId.get(`left${part}`)
    const right = byId.get(`right${part}`)
    if (left == null || right == null || Math.abs(left - right) < SIDE_GAP_POINTS) continue
    const leftWeaker = left < right
    gaps.push({
      part: part.toLowerCase(),
      weakerSide: leftWeaker ? 'left' : 'right',
      weakerScore: leftWeaker ? left : right,
      strongerScore: leftWeaker ? right : left,
    })
  }
  // The biggest gap is the one worth mentioning.
  return gaps.sort((a, b) => b.strongerScore - b.weakerScore - (a.strongerScore - a.weakerScore))[0] ?? null
}

/**
 * Facts for the note, or null when the camera judged nothing (a hand-scored stretch).
 * `metrics` is the same body the session is saved with (jointResults, limbResults, ...).
 */
export function sessionNoteFacts(exercise, metrics) {
  const joints = metrics.jointResults ?? []
  if (joints.length === 0) return null
  const limbs = metrics.limbResults ?? []

  const sorted = [...joints].sort((a, b) => a.timeInRangePct - b.timeInRangePct || b.avgError - a.avgError)
  const needsWork = sorted
    .filter((j) => j.timeInRangePct < IN_RANGE_GOAL_PCT)
    .slice(0, MAX_LISTED)
    .map((j) => ({
      joint: jointName(j.joint),
      limb: LIMB_BY_JOINT[j.joint] ? limbLabel(LIMB_BY_JOINT[j.joint]) : null,
      inRangePct: j.timeInRangePct,
      averageErrorDegrees: Math.round(j.avgError),
    }))
  const heldWell = sorted
    .filter((j) => j.timeInRangePct >= IN_RANGE_GOAL_PCT)
    .reverse()
    .slice(0, MAX_LISTED)
    .map((j) => jointName(j.joint))

  return {
    exercise: exercise.title,
    targetArea: areaLabel(exercise.targetArea),
    formScore: metrics.trackingScore ?? null,
    needsWork,
    heldWell,
    limbs: [...limbs].sort((a, b) => a.score - b.score).map((l) => ({ name: limbLabel(l.limb), score: l.score })),
    sideGap: sideGap(limbs),
    fatigue: metrics.fatigue ?? null,
  }
}

const listJoints = (items) => {
  const parts = items.map((j) => `${j.joint} (in range ${j.inRangePct}% of the time)`)
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]
}

// Plain wording used when Groq is not configured or does not answer.
export function templateSessionNote(facts) {
  const parts = []
  if (facts.needsWork.length === 0) {
    parts.push(`${facts.exercise}: every tracked joint stayed in range at least ${IN_RANGE_GOAL_PCT}% of the time.`)
  } else {
    const verb = facts.needsWork.length === 1 ? 'was' : 'were'
    parts.push(`${facts.exercise}: my ${listJoints(facts.needsWork)} ${verb} the hardest to hold in position.`)
  }
  const gap = facts.sideGap
  if (gap) {
    const other = gap.weakerSide === 'left' ? 'right' : 'left'
    parts.push(`My ${gap.weakerSide} ${gap.part} lagged behind my ${other} (${gap.weakerScore} vs ${gap.strongerScore}).`)
  }
  return parts.join(' ')
}
