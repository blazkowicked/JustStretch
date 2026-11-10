import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DifficultyBadge from '../components/DifficultyBadge.jsx'
import { InputError, InputLabel, PrimaryButton } from '../components/forms.jsx'
import Icon from '../components/Icon.jsx'
import LimbBreakdown from '../components/LimbBreakdown.jsx'
import PerfPanel from '../components/PerfPanel.jsx'
import ReferralCard from '../components/ReferralCard.jsx'
import { api, apiTimings } from '../lib/api.js'
import { areaLabel, hasPlayableVideo, highlightsHands, instructionSteps } from '../lib/enums.js'
import { plural } from '../lib/format.js'
import { on } from '../lib/eventBus.js'
import { useFetch, useForm, usePageTitle } from '../lib/hooks.js'
import { thumbnailFor } from '../lib/media.js'
import { FATIGUE_LABELS, toPerfPayload, toSessionMetrics } from '../lib/sessionMetrics.js'
import { card, container, label as labelClass, sectionTitle, statLabel, textarea } from '../lib/ui.js'
import PoseStage from '../pose/PoseStage.jsx'
import NotFound from './NotFound.jsx'

// Status line beside the Notes label while the API drafts them from the session results.
function NoteDraftStatus({ status, onRedo }) {
  const redo = (text) => (
    <button type="button" onClick={onRedo} className="font-medium text-accent hover:text-accent-dark">
      {text}
    </button>
  )
  return (
    <p id="notes_draft_status" className="text-[13px] text-muted" role="status">
      {status === 'drafting' && 'Writing notes from your results…'}
      {status === 'ready' && (
        <>
          Drafted from your results. Edit freely. {redo('Write again')}
        </>
      )}
      {status === 'failed' && (
        <>
          Couldn&apos;t draft notes. {redo('Try again')}
        </>
      )}
    </p>
  )
}

// Score form. Hidden until the pose tracker emits `session-ended` on the event bus.
// A suggested score from the camera tracking pre-fills the slider and is marked as
// automatic; otherwise the user rates their own form.
function ScoreForm({ exercise }) {
  const navigate = useNavigate()
  const form = useForm({ notes: '' })
  const [open, setOpen] = useState(false)
  const [score, setScore] = useState(null)
  const [seconds, setSeconds] = useState(null)
  const [auto, setAuto] = useState(false)
  const [summary, setSummary] = useState(null)
  const [savedSession, setSavedSession] = useState(null)
  const [autoSaving, setAutoSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [fatigue, setFatigue] = useState(null)
  // ?perf runs: the tracker's full log, and the saved session (the page stays open so the
  // save's response time can go into the downloaded log).
  const [perfLog, setPerfLog] = useState(null)
  const [saved, setSaved] = useState(null)
  // Notes drafted from the camera results ('drafting' | 'ready' | 'failed' | null).
  const [noteStatus, setNoteStatus] = useState(null)
  const notesTouched = useRef(false)
  const noteToken = useRef(0)
  const { setField } = form
  const section = useRef(null)
  // One guard per workout: remember the clientId we tried to save, and ignore
  // a late response once the user has started a newer session.
  const savedKeys = useRef(new Set())
  const lastKey = useRef(null)
  const autoSaveToken = useRef(0)

  // Asks the API to write the Notes box from what did not stretch properly. Only fills
  // the box while the member has not typed in it; "Write again" overwrites on purpose.
  // Not saved until they press Save / Update session.
  const draftNote = useCallback(
    (sessionSummary, { overwrite = false, fatigue: fatigueRating = null } = {}) => {
      const metrics = { ...toSessionMetrics(sessionSummary), ...(fatigueRating == null ? {} : { fatigue: fatigueRating }) }
      const judgedEnough =
        sessionSummary?.hasReference && sessionSummary.judgedFrames >= sessionSummary.minJudgedFrames && metrics.jointResults?.length
      if (!judgedEnough) {
        setNoteStatus(null)
        return
      }
      if (overwrite) notesTouched.current = false
      const token = ++noteToken.current
      setNoteStatus('drafting')
      api
        .post(`/exercises/${exercise.id}/session-note`, metrics)
        .then(({ note }) => {
          if (noteToken.current !== token) return
          if (!note) return setNoteStatus(null)
          if (!notesTouched.current) setField('notes', note)
          setNoteStatus('ready')
        })
        .catch(() => {
          if (noteToken.current === token) setNoteStatus('failed')
        })
    },
    [exercise.id, setField],
  )

  useEffect(() => {
    return on('session-ended', (detail) => {
      const key = detail.sessionId ?? `${exercise.id}:${detail.seconds}:${Date.now()}`
      lastKey.current = key
      autoSaveToken.current += 1
      setSavedSession(null)
      setSaveError(null)
      setAutoSaving(false)
      setSaved(null)
      setPerfLog(detail.perfLog ?? null)
      setSeconds(detail.seconds)
      setSummary(detail.summary ?? null)
      setAuto(detail.score != null)
      setScore(detail.score ?? null)
      setFatigue(null)
      setOpen(true)
      notesTouched.current = false
      setField('notes', '')
      draftNote(detail.summary)

      // Only the automatic end condition saves by itself, and only when the
      // camera produced a score (the API requires one). Manual ends keep the
      // ordinary form. The clientId makes a retry idempotent.
      if (detail.reason !== 'complete' || detail.score == null || savedKeys.current.has(key)) return
      savedKeys.current.add(key)
      const token = autoSaveToken.current
      setAutoSaving(true)
      api
        .post(`/exercises/${exercise.id}/sessions`, {
          score: detail.score,
          durationSeconds: detail.seconds,
          clientId: key,
          ...toSessionMetrics(detail.summary),
          ...(detail.perf ? { perf: toPerfPayload(detail.perf) } : {}),
        })
        .then(({ session, referral, message }) => {
          if (autoSaveToken.current !== token) return
          setSavedSession(session)
          // In ?perf runs the page stays open so the save's response time can be
          // written into the downloaded log.
          if (detail.perfLog) setSaved({ sessionId: session.id, referral, message, timing: apiTimings().at(-1) ?? null })
        })
        .catch((error) => {
          savedKeys.current.delete(key)
          if (autoSaveToken.current === token) setSaveError(error.message)
        })
        .finally(() => {
          if (autoSaveToken.current === token) setAutoSaving(false)
        })
    })
  }, [exercise.id, draftNote, setField])

  useEffect(() => {
    if (open) section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open])

  if (!open) return null

  const judged = summary && summary.hasReference && summary.judgedFrames >= summary.minJudgedFrames

  const submit = (event) => {
    event.preventDefault()
    form.submit(async ({ notes }) => {
      // Already auto-saved: only send what the user may have changed.
      if (savedSession) {
        const { message } = await api.patch(`/sessions/${savedSession.id}`, {
          score,
          notes: notes ?? '',
          ...(fatigue == null ? {} : { fatigue }),
        })
        if (perfLog) {
          setSaved({
            sessionId: savedSession.id,
            referral: savedSession.referral ?? null,
            message,
            timing: apiTimings().at(-1) ?? null,
          })
          return
        }
        navigate(savedSession.referral ? `/sessions/${savedSession.id}` : '/dashboard', { state: { flash: message } })
        return
      }

      const { session, referral, message } = await api.post(`/exercises/${exercise.id}/sessions`, {
        score,
        durationSeconds: seconds,
        notes,
        clientId: lastKey.current,
        // The camera results, in the names the API stores them under.
        ...toSessionMetrics(summary),
        ...(fatigue == null ? {} : { fatigue }),
        ...(perfLog ? { perf: toPerfPayload(perfLog.summary) } : {}),
      })
      if (perfLog) {
        setSaved({ sessionId: session.id, referral, message, timing: apiTimings().at(-1) ?? null })
        return
      }
      // When the referral threshold was met, the session page shows the therapist's contact.
      navigate(referral ? `/sessions/${session.id}` : '/dashboard', { state: { flash: message } })
    })
  }

  return (
    <section ref={section} className={`${card} scroll-mt-20 p-6 sm:p-8`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className={sectionTitle}>How did it go?</h2>
        <p className="text-sm text-muted">
          Session length{' '}
          <span className="font-semibold tabular-nums text-ink">
            {seconds !== null && seconds !== '' ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : '—'}
          </span>
        </p>
      </div>

      {autoSaving && (
        <p className="mt-2 text-xs text-muted" role="status">
          Saving this session automatically…
        </p>
      )}
      {savedSession && (
        <p className="mt-2 text-xs text-accent">
          Saved automatically when the session completed. You can still adjust the score, fatigue or notes below.
        </p>
      )}
      {saveError && (
        <p className="mt-2 text-xs text-danger" role="alert">
          Could not save automatically ({saveError}). Use the button below to save it.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Tracking results: filled in by the session-ended event */}
        {summary && (
          <div className="rounded-lg border border-line bg-paper-2 p-5">
            {judged ? (
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Tracking results</h3>
                    <p className="text-sm text-muted">
                      <span className="font-semibold tabular-nums text-ink">{summary.goodFrames}</span> of{' '}
                      <span className="tabular-nums">{summary.judgedFrames}</span> judged frames were within the margin of error.
                    </p>
                    {summary.totalReps > 1 && (
                      <p className="mt-1 text-sm text-muted">
                        Completed <span className="font-semibold tabular-nums text-ink">{summary.repsCompleted}</span> of{' '}
                        <span className="tabular-nums">{summary.totalReps}</span> reps across{' '}
                        <span className="font-semibold tabular-nums text-ink">{summary.setsCompleted}</span> of{' '}
                        <span className="tabular-nums">{summary.totalSets}</span> sets.
                      </p>
                    )}
                  </div>
                  <span className="text-4xl font-mono font-medium tabular-nums text-accent">
                    {`${Math.round((100 * summary.goodFrames) / summary.judgedFrames)}%`}
                  </span>
                </div>

                <div className="relative mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="py-1 text-left font-semibold">Joint</th>
                        <th className="py-1 text-right font-semibold">Average error</th>
                        <th className="py-1 text-right font-semibold">Time in range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.joints.map((joint) => (
                        <tr key={joint.name} className="border-t border-line">
                          <td className="py-2 capitalize">{joint.name.replace(/_/g, ' ')}</td>
                          <td className="py-2 text-right tabular-nums">{`${joint.meanErrorDeg.toFixed(1)}°`}</td>
                          <td className={`py-2 text-right font-semibold tabular-nums ${joint.inRangePct >= 80 ? 'text-accent' : 'text-danger'}`}>
                            {`${joint.inRangePct}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* The same frames grouped into limbs (leftArm, rightArm, ...). Limbs the
                    camera never judged show as "Not assessed", never as 0%. */}
                <LimbBreakdown results={summary.limbs} heading="Per-limb breakdown" className="mt-4 border-t border-line pt-4" />
              </div>
            ) : (
              <div className="text-sm">
                <h3 className="font-semibold">No tracking score for this session</h3>
                <p className="mt-1 text-ink-2">
                  {!summary.hasReference
                    ? 'This exercise has no reference pose yet, so rate your form yourself.'
                    : `Only ${summary.judgedFrames} frames could be judged (at least ${summary.minJudgedFrames} are needed). Keep your upper body fully in view and try again.`}
                </p>
                {/* Limb results come from the same camera frames, so both paths
                    without them say so explicitly. */}
                <p className="mt-1 text-ink-2">
                  {!summary.hasReference
                    ? 'Limb scoring requires camera tracking, so this session has no per-limb breakdown.'
                    : 'There was not enough judged data for a per-limb breakdown either.'}
                </p>
                {summary.hasReference && summary.camera && (
                  <p className="mt-1 text-ink-2">
                    {summary.camera === 'Cam_Side'
                      ? 'This stretch is tracked from the side: stand sideways to the camera.'
                      : 'This stretch is tracked from the front: face the camera.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {saved ? (
          <div className={`space-y-3 ${summary ? '' : 'lg:col-span-2'}`} role="status">
            <p className="font-semibold">{saved.message}</p>
            <Link to={`/sessions/${saved.sessionId}`} className="text-sm font-semibold text-accent hover:underline">
              Open the saved session
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className={`space-y-6 ${summary ? '' : 'lg:col-span-2'}`}>
            <div>
              <div className="flex items-end justify-between">
                <InputLabel htmlFor="score" value="Form score" />
                <span className="text-3xl font-mono font-medium tabular-nums text-accent">{score ?? '—'}</span>
              </div>
              <p className="text-[13px] text-muted">How well did you hold the form? 0 = couldn&apos;t do it, 100 = perfect.</p>
              {auto && <p className="text-[13px] font-semibold text-accent">Suggested from your camera tracking. You can adjust it before saving.</p>}
              <input
                id="score"
                name="score"
                type="range"
                min="0"
                max="100"
                step="1"
                value={score ?? 50}
                onChange={(event) => setScore(Number(event.target.value))}
                className="mt-3 w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-muted">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
              <InputError messages={form.errors.score} className="mt-2" />
              <InputError messages={form.errors.durationSeconds} className="mt-2" />
            </div>

            <div>
              <p className={labelClass}>How tired do you feel?</p>
              <p className="text-[13px] text-muted">Optional. Your own rating of how tired your body felt at the end.</p>
              <div role="group" aria-label="Fatigue rating" className="mt-3 flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFatigue(fatigue === level ? null : level)}
                    aria-pressed={fatigue === level}
                    className={`h-11 flex-1 rounded-md border text-sm font-semibold tabular-nums transition-colors ${
                      fatigue === level
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:bg-paper-2'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-muted">
                {fatigue == null ? 'Not set' : `${fatigue}: ${FATIGUE_LABELS[fatigue]}`}
              </p>
              <InputError messages={form.errors.fatigue} className="mt-2" />
            </div>

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <InputLabel htmlFor="notes" value="Notes (optional)" />
                <NoteDraftStatus status={noteStatus} onRedo={() => draftNote(summary, { overwrite: true, fatigue })} />
              </div>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={500}
                className={`mt-1.5 ${textarea}`}
                placeholder={noteStatus === 'drafting' ? 'Writing notes from your results…' : 'e.g. Left side felt tighter than the right.'}
                aria-describedby="notes_draft_status"
                {...form.bind('notes')}
                onChange={(event) => {
                  notesTouched.current = true
                  form.setField('notes', event.target.value)
                }}
              />
              <InputError messages={form.errors.notes} className="mt-2" />
            </div>

            <InputError messages={form.errors._form} />

            <div className="flex justify-end">
              <PrimaryButton size="lg" disabled={form.processing || autoSaving}>
                {savedSession ? 'Update session' : 'Save session'}
              </PrimaryButton>
            </div>
          </form>
        )}
      </div>

      {saved?.referral && (
        <div className="mt-6">
          <ReferralCard referral={saved.referral} />
        </div>
      )}

      {perfLog && (
        <div className="mt-6">
          <PerfPanel log={perfLog} saved={saved} title={exercise.title} />
        </div>
      )}
    </section>
  )
}

// The reference video fills its tile. Without a playable file it shows the poster frame or a note.
// It follows the session: rewinds and waits during the 3-2-1 countdown, plays from the
// start at "Go", pauses with Pause (or a lost camera), picks up again on Resume, and
// stops when the session ends.
function ReferenceVideo({ url }) {
  const videoEl = useRef(null)

  useEffect(() => {
    const play = (fromStart = false) => {
      const el = videoEl.current
      if (!el) return
      if (fromStart) el.currentTime = 0
      el.play().catch(() => {}) // autoplay can be refused; the controls still work
    }
    const pause = (rewind = false) => {
      const el = videoEl.current
      if (!el) return
      el.pause()
      if (rewind) el.currentTime = 0
    }

    // `session-running` true fires when the camera is ready, before the countdown.
    const offRunning = on('session-running', (running) => pause(running))
    const offStarted = on('session-started', () => play(true))
    const offPaused = on('session-paused', (paused) => (paused ? pause() : play()))
    return () => {
      offRunning()
      offStarted()
      offPaused()
    }
  }, [])

  if (url && hasPlayableVideo(url)) {
    return (
      <video
        ref={videoEl}
        src={url}
        poster={thumbnailFor(url) ?? undefined}
        controls
        loop
        playsInline
        muted
        preload="metadata"
        className="h-full w-full object-cover"
      />
    )
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-white/80">
      <Icon name="camera" className="h-8 w-8" strokeWidth={1.4} />
      <p className="text-sm font-semibold">{url ? 'This video plays on its original site.' : 'Demo video coming soon.'}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent-mid underline underline-offset-2">
          Open the video
        </a>
      ) : (
        <p className="text-xs text-white/60">Follow the steps below the camera.</p>
      )}
    </div>
  )
}

// One step at a time under the tiles, so the user can read it from a distance.
function StepCaption({ steps }) {
  const [index, setIndex] = useState(0)
  if (steps.length === 0) return null
  const stepButton =
    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong disabled:opacity-40'

  return (
    <div className={`${card} flex items-center gap-4 p-4 sm:p-5`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-base font-medium text-white">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className={statLabel}>
          Step {index + 1} of {steps.length}
        </p>
        <p className="mt-0.5 text-base font-semibold leading-snug sm:text-lg" aria-live="polite">
          {steps[index]}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" className={stepButton} onClick={() => setIndex((i) => i - 1)} disabled={index === 0} aria-label="Previous step">
          <Icon name="chevronLeft" className="h-5 w-5" />
        </button>
        <button
          type="button"
          className={stepButton}
          onClick={() => setIndex((i) => i + 1)}
          disabled={index === steps.length - 1}
          aria-label="Next step"
        >
          <Icon name="chevronRight" className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

// Session mode has its own slim bar instead of the app navigation, so the tiles get the room.
function SessionBar({ exercise, stopButton }) {
  const navigate = useNavigate()
  const exitTo = `/exercises/${exercise.id}`

  const exit = (event) => {
    // The tracker enables End session only while a session is running.
    if (stopButton.current && !stopButton.current.disabled) {
      event.preventDefault()
      if (window.confirm('Leave this session? Your progress will not be saved.')) navigate(exitTo)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className={`${container} flex h-16 items-center gap-4`}>
        <Link
          to={exitTo}
          onClick={exit}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
        >
          <Icon name="x" className="h-4 w-4" strokeWidth={2.2} />
          Exit
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-base font-semibold sm:text-lg">{exercise.title}</p>
          <p className="truncate text-[11px] font-semibold text-muted">
            {exercise.durationMinutes} min, {exercise.sets ?? 1} {plural('set', exercise.sets ?? 1)} ×{' '}
            {exercise.repsPerSet ?? 1} {plural('rep', exercise.repsPerSet ?? 1)}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-[13px] font-medium text-accent">{areaLabel(exercise.targetArea)}</span>
          <DifficultyBadge difficulty={exercise.difficulty} />
        </div>
      </div>
    </header>
  )
}

function SessionShell({ title, children }) {
  usePageTitle(title)
  return <div className="min-h-screen">{children}</div>
}

export default function SessionCreate() {
  const { id } = useParams()
  const { data, error, loading } = useFetch(`/exercises/${id}`)
  const stopButton = useRef(null)

  if (error?.status === 404) return <NotFound />

  if (!data) {
    return (
      <SessionShell title="Session">
        <div className={`${container} py-10`}>
          <p className={`text-sm ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : 'status'}>
            {loading ? 'Loading session…' : `Could not load this exercise: ${error?.message}`}
          </p>
        </div>
      </SessionShell>
    )
  }

  const { exercise } = data
  const area = areaLabel(exercise.targetArea).toLowerCase()

  return (
    <SessionShell title={`Session · ${exercise.title}`}>
      <SessionBar exercise={exercise} stopButton={stopButton} />

      <div className={`${container} space-y-6 pb-16 pt-6`}>
        <PoseStage
          key={exercise.id}
          videoUrl={exercise.videoUrl}
          targetArea={exercise.targetArea}
          stopButtonRef={stopButton}
          durationMinutes={exercise.durationMinutes}
          sets={exercise.sets ?? 1}
          repsPerSet={exercise.repsPerSet ?? 1}
          reference={<ReferenceVideo url={exercise.videoUrl} />}
        >
          <StepCaption steps={instructionSteps(exercise.instructions)} />
        </PoseStage>

        <ScoreForm exercise={exercise} />

        <div className="grid gap-4 md:grid-cols-2">
          {exercise.precautions && (
            <section className="flex gap-3 rounded-lg border border-caution/40 bg-caution-soft p-5 text-sm text-ink" role="note">
              <Icon name="warn" className="h-5 w-5 shrink-0" strokeWidth={1.8} />
              <div>
                <h2 className="font-semibold">Precautions</h2>
                <p className="mt-1 leading-relaxed">{exercise.precautions}</p>
              </div>
            </section>
          )}

          <section className={`${card} flex gap-3 p-5 text-sm`}>
            <Icon name="body" className="h-5 w-5 shrink-0 text-accent" />
            <div>
              <h2 className="font-semibold">Joints highlighted</h2>
              <p className="mt-1 leading-relaxed text-ink-2">
                Joints for the <strong className="text-ink">{area}</strong> are drawn larger in green; the rest of the skeleton is grey.{' '}
                {highlightsHands(exercise.targetArea)
                  ? 'Your fingers are tracked too (21 points per hand) and drawn in green for this stretch.'
                  : 'Your fingers are tracked too, shown in grey.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    </SessionShell>
  )
}
