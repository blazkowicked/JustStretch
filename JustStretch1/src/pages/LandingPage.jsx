import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Contact from '../components/Contact.jsx'
import Icon from '../components/Icon.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import PublicLayout from '../layouts/PublicLayout.jsx'
import { btn, card, container, statLabel } from '../lib/ui.js'

// Type sizes for this page only, so the app pages keep their own scale.
const sectionHead = 'min-w-0 text-balance text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] [overflow-wrap:break-word] sm:text-[44px] lg:text-[52px]'
const itemHead = 'text-[22px] font-semibold leading-tight tracking-[-0.01em] sm:text-[25px]'
const lead = 'text-[18px] leading-relaxed text-ink-2 sm:text-[21px]'

// The hero is the Just Stretch ad (public/ad/). It starts muted because browsers only
// autoplay silent video; the buttons in its corner pause it and turn the sound on.
// Its background is #f8fafa, so the section uses the same colour and the letterbox
// around the 16:9 frame disappears into the page.
const AD = {
  poster: '/ad/ad-poster.jpg',
  sources: [
    { src: '/ad/ad-720.mp4', media: '(max-width: 767px)' },
    { src: '/ad/ad-1080.mp4' },
  ],
  label: 'Just Stretch ad: follow a 3D guide, let your webcam score your form, watch your form climb, and get an AI summary of your progress.',
}

const heroHead = 'min-w-0 text-balance text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] [overflow-wrap:break-word] sm:text-[42px] lg:text-[48px]'

function HeroAd() {
  const area = useRef(null)
  const video = useRef(null)
  // The largest 16:9 frame that fits the space left above the headline, so the
  // controls sit on the video's own corner instead of the screen's.
  const [frame, setFrame] = useState(null)
  useEffect(() => {
    const el = area.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const w = Math.min(width, (height * 16) / 9)
      setFrame({ width: Math.floor(w), height: Math.floor((w * 9) / 16) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  // Reduced-motion visitors get the poster and press play themselves.
  const [autoPlay] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  const togglePlay = () => {
    const el = video.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }

  const toggleSound = () => {
    const el = video.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
    if (!el.muted && el.paused) el.play().catch(() => {})
  }

  const control =
    'flex h-8 w-8 items-center justify-center rounded-full sm:h-10 sm:w-10 bg-ink/75 text-white backdrop-blur-sm transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

  return (
    <div ref={area} className="relative aspect-video w-full sm:aspect-auto sm:min-h-[14rem] sm:flex-1">
      <div className="absolute inset-0 m-auto aspect-video max-h-full max-w-full" style={frame ?? { width: '100%' }}>
        <video
          ref={video}
          className="h-full w-full"
          poster={AD.poster}
          autoPlay={autoPlay}
          muted
          loop
          playsInline
          preload="auto"
          aria-label={AD.label}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        >
          {AD.sources.map((source) => (
            <source key={source.src} src={source.src} media={source.media} type="video/mp4" />
          ))}
        </video>
        <div className="absolute bottom-2 right-2 flex gap-1.5 sm:bottom-4 sm:right-4 sm:gap-2">
          <button type="button" onClick={togglePlay} className={control} aria-label={playing ? 'Pause the ad' : 'Play the ad'}>
            <Icon name={playing ? 'pause' : 'play'} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <button type="button" onClick={toggleSound} className={control} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
            <Icon name={muted ? 'soundOff' : 'soundOn'} className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Example values for the readout. They show what a session looks like, not anyone's data.
const READOUT = [
  { joint: 'Neck tilt', measured: 31, target: 35 },
  { joint: 'Left shoulder', measured: 8, target: 6 },
  { joint: 'Right shoulder', measured: 14, target: 4 },
]
const TOLERANCE = 10

const STOP = ['Sharp or worsening pain', 'Numbness or tingling spreading into an arm or leg', 'Dizziness', 'Pain from a recent injury or surgery']

const FAQ = [
  ['Do I need any equipment?', 'A laptop or phone with a webcam, and enough space to be seen from head to hips. Nothing else.'],
  [
    'Which body areas are covered?',
    'Neck, shoulders, chest, back, hips, legs and wrists. Stretches with a 3D reference video get a live score from the camera; the rest use a score you rate yourself.',
  ],
  ['Is it free?', 'Yes. You need an account to save sessions and see your history.'],
  ['Who made this?', 'Four IT students at José Rizal University in Mandaluyong City, as a research project on browser-based pose tracking.'],
]

// One deviation bar: the shaded band is the tolerance, the tick is the target, the dot is you.
function DeviationBar({ deviation }) {
  const off = Math.abs(deviation) >= TOLERANCE
  const x = 60 + Math.max(-56, Math.min(56, deviation * 4))
  return (
    <svg viewBox="0 0 120 18" className="h-[18px] w-[120px] shrink-0" aria-hidden="true">
      <rect x="4" y="8" width="112" height="2" rx="1" className="fill-line" />
      <rect x="20" y="5" width="80" height="8" rx="2" className="fill-accent-soft" />
      <rect x="59" y="3" width="2" height="12" className="fill-ink-2" />
      <circle cx={x} cy="9" r="5" className={`stroke-surface ${off ? 'fill-caution' : 'fill-accent'}`} strokeWidth="1.5" />
    </svg>
  )
}

// Measured vs target angle at the neck, with the tolerance noted underneath.
function AngleDiagram() {
  return (
    <svg
      viewBox="0 0 560 300"
      className="h-auto w-full"
      role="img"
      aria-label="Diagram: measured neck tilt of 31 degrees against a 35 degree target, within a 10 degree tolerance"
    >
      <path d="M80 250H480" className="stroke-line" />
      <path d="M150 200L280 196L410 200" className="stroke-ink-2" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M280 196L280 70" className="stroke-line-strong" strokeWidth="2" strokeDasharray="5 6" />
      <path d="M280 196L338 88" className="stroke-ink-2" strokeWidth="2" strokeDasharray="3 5" />
      <path d="M280 196L322 80" className="stroke-accent" strokeWidth="4" strokeLinecap="round" />
      <circle cx="330" cy="56" r="26" className="stroke-ink-2" strokeWidth="3" fill="none" />
      <path d="M280 136A60 60 0 0 1 300.5 139.6" className="stroke-accent" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="280" cy="196" r="7" className="fill-accent stroke-surface" strokeWidth="2" />
      <circle cx="150" cy="200" r="5" className="fill-ink-2" />
      <circle cx="410" cy="200" r="5" className="fill-ink-2" />
      <text x="96" y="104" className="fill-accent text-[15px]">
        Measured 31°
      </text>
      <text x="352" y="128" className="fill-ink-2 text-[15px]">
        Target 35°
      </text>
      <text x="80" y="282" className="fill-muted text-[14px]">
        Neck tilt within the ±10° tolerance: in range
      </text>
    </svg>
  )
}

function Readout() {
  return (
    <figure className={`${card} overflow-hidden`} aria-label="Example of the live readout during a session">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <p className="flex items-baseline gap-3">
          <span className="text-base font-semibold">Neck Side Tilt</span>
          <span className={statLabel}>Step 2 of 4</span>
        </p>
        <span className="text-[13px] font-medium text-accent">
          Live <span className="font-mono">01:24</span>
        </span>
      </div>
      <div className="flex gap-5 p-5">
        <img
          src="/thumbs/neck_side_tilt.jpg"
          alt=""
          loading="lazy"
          className="hidden h-[220px] w-[170px] shrink-0 rounded-md object-cover sm:block"
        />
        <div className="min-w-0 flex-1">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className={`${statLabel} pb-2 font-medium`}>Joint</th>
                <th className={`${statLabel} pb-2 text-right font-medium`}>Measured</th>
                <th className={`${statLabel} pb-2 text-right font-medium`}>Target</th>
                <th className={`${statLabel} hidden pb-2 pl-4 font-medium md:table-cell`}>Deviation (±{TOLERANCE}°)</th>
              </tr>
            </thead>
            <tbody>
              {READOUT.map((row) => (
                <tr key={row.joint} className="border-b border-line">
                  <td className="py-3 font-medium">{row.joint}</td>
                  <td className="py-3 text-right font-mono">{row.measured}°</td>
                  <td className="py-3 text-right font-mono text-muted">{row.target}°</td>
                  <td className="hidden py-3 pl-4 md:table-cell">
                    <DeviationBar deviation={row.measured - row.target} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 flex items-center gap-2 rounded-md bg-caution-soft px-3 py-2.5 text-sm font-medium text-caution">
            <Icon name="warn" className="h-4 w-4 shrink-0" />
            Right shoulder is 10° above target. Lower it.
          </p>
        </div>
      </div>
      <figcaption className="flex items-center justify-between border-t border-line bg-paper-2 px-5 py-3">
        <span className={statLabel}>Form score</span>
        <span className="font-mono text-base font-medium">86 / 100</span>
      </figcaption>
    </figure>
  )
}

export default function LandingPage() {
  const { user } = useAuth()
  const { hash } = useLocation()

  // Links like /#contact from other pages scroll to the section once the page is rendered.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  const HELP = [
    {
      icon: 'search',
      title: 'Find a stretch',
      body: 'Browse stretches by body area and level, with the ones for your pain areas first.',
      to: user ? '/exercises' : '/register',
      action: 'Browse the library',
    },
    {
      icon: 'play',
      title: 'Start a session',
      body: 'Follow the 3D guide on screen while your webcam checks each joint you hold.',
      to: user ? '/dashboard' : '/register',
      action: 'Start stretching',
    },
    {
      icon: 'chart',
      title: 'Track your progress',
      body: 'Every session is scored and saved, so you can see your form week to week.',
      to: user ? '/sessions' : '/register',
      action: 'See your history',
    },
  ]

  return (
    <PublicLayout contactBar>
      {/* Hero: the ad fills the screen, with the headline and buttons centred underneath.
          On phones the 16:9 ad cannot fill a tall screen, so the hero is only as tall as its content. */}
      <section id="hero" className="flex flex-col bg-[#f8fafa] sm:min-h-[calc(100dvh-6.25rem)]">
        <HeroAd />
        <div className={`${container} pb-10 pt-5 text-center sm:pb-12 sm:pt-6`}>
          <h1 className={`mx-auto max-w-[62rem] ${heroHead}`}>Stretch at home, with measured feedback.</h1>
          <p className="mx-auto mt-3 max-w-[40rem] text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
            Follow a 3D guide while your webcam checks every joint angle.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to={user ? '/dashboard' : '/register'} className={`${btn.primary} h-12 px-6 text-base`}>
              {user ? 'Go to your dashboard' : 'Create a free account'}
            </Link>
            <a href="#how-it-works" className={`${btn.secondary} h-12 px-6 text-base`}>
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* How can we help: the three things a visitor comes to do. */}
      <section className="py-24 sm:py-32">
        <div className={container}>
          <h2 className={`${sectionHead} text-center`}>How can we help you today?</h2>
          <ul className="mx-auto mt-14 grid max-w-[72rem] gap-6 md:grid-cols-3">
            {HELP.map((item) => (
              <li key={item.title} className={`${card} flex flex-col items-center px-8 py-10 text-center`}>
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white" aria-hidden="true">
                  <Icon name={item.icon} className="h-7 w-7" />
                </span>
                <h3 className={`mt-6 ${itemHead}`}>{item.title}</h3>
                <p className="mt-3 max-w-[22rem] text-base leading-relaxed text-ink-2">{item.body}</p>
                <Link to={item.to} className="mt-6 inline-flex h-11 items-center font-medium text-accent underline-offset-4 hover:underline">
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The reference video beside the two things the app stands for. */}
      <section className="border-y border-line bg-paper-2 py-24 sm:py-32">
        <div className={`${container} grid items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20`}>
          <figure className="min-w-0">
            <video
              src="/videos/neck_side_tilt.mp4"
              poster="/thumbs/neck_side_tilt.jpg"
              controls
              muted
              playsInline
              preload="none"
              className="aspect-video w-full rounded-lg bg-ink object-cover"
            />
            <figcaption className="mt-3 text-sm text-muted">Neck Side Tilt, one of the 3D reference animations made in Blender.</figcaption>
          </figure>
          <div className="min-w-0">
            <h2 className={itemHead}>Measured, not guessed</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
              MediaPipe finds 33 points on your body in each camera frame. JustStretch turns them into joint angles and compares them
              with the same angles in the reference, frame by frame.
            </p>
            <hr className="my-10 w-24 border-t-2 border-accent" />
            <h2 id="privacy" className={`scroll-mt-24 ${itemHead}`}>
              Your video stays on your device
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
              Tracking runs in your browser tab. Saving a session stores the score, its length and your notes; video frames, images and
              body landmarks never leave.
            </p>
          </div>
        </div>
      </section>

      {/* The product: what a session shows, set large. */}
      <section id="how-it-works" className="scroll-mt-20 py-24 sm:py-36">
        <div className={container}>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <h2 className={`${sectionHead} lg:col-span-6`}>What a session shows you</h2>
            <p className={`${lead} lg:col-span-5 lg:col-start-8`}>
              Each joint you hold is checked against its target, within a tolerance set for that stretch.
            </p>
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Readout />
            <div className={`${card} flex items-center p-6`}>
              <AngleDiagram />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">The readout and diagram are examples of what a session shows.</p>
        </div>
      </section>

      {/* Limits: when to stop, as rows. */}
      <section id="limits" className="border-t border-line bg-surface py-24 sm:py-32">
        <div className={`${container} grid gap-12 lg:grid-cols-12`}>
          <div className="lg:col-span-4">
            <h2 className={sectionHead}>A guide, not a diagnosis.</h2>
            <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
              For mild, everyday stiffness. If your scores for an area stay low, or you rate yourself very tired session after session, the
              app suggests a physical therapist and shows their contact details.
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <p className="text-base font-medium text-caution">Stop the stretch and seek care if you feel</p>
            <ul className="mt-4 border-t border-line">
              {STOP.map((item) => (
                <li key={item} className="flex items-center gap-4 border-b border-line py-6 text-[20px] font-medium sm:text-[22px]">
                  <Icon name="warn" className="h-5 w-5 shrink-0 text-caution" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Questions, then the action once more. */}
      <section className="border-t border-line bg-paper-2 py-24 sm:py-32">
        <div className={container}>
          <h2 className={sectionHead}>Common questions</h2>
          <dl className="mt-12 grid gap-x-16 md:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q} className="border-t border-line-strong pb-8 pt-6">
                <dt className={itemHead}>{q}</dt>
                <dd className="mt-3 max-w-[36rem] text-[17px] leading-relaxed text-ink-2">{a}</dd>
              </div>
            ))}
          </dl>
          {!user && (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/register" className={`${btn.primary} h-12 px-6 text-base`}>
                Create a free account
              </Link>
              <span className="text-[15px] text-muted">Takes under a minute.</span>
            </div>
          )}
        </div>
      </section>

      <Contact />
    </PublicLayout>
  )
}
