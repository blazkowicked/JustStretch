// Outline icons (Heroicons-style paths) used across the redesign. <Icon name="lock" className="h-5 w-5" />
const PATHS = {
  lock: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  search: 'M21 21l-5.2-5.2M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z',
  camera:
    'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  users:
    'M15 19.13a9.38 9.38 0 002.63.37 9.34 9.34 0 004.12-.95 4.13 4.13 0 00-7.53-2.49M15 19.13v-.01c0-1.12-.29-2.17-.79-3.08M15 19.13v.1A12.32 12.32 0 018.62 21c-2.33 0-4.51-.64-6.37-1.77v-.11a6.38 6.38 0 0111.96-3.08M12 6.38a3.38 3.38 0 11-6.75 0 3.38 3.38 0 016.75 0zm8.25 2.25a2.63 2.63 0 11-5.25 0 2.63 2.63 0 015.25 0z',
  book: 'M12 6.04A8.97 8.97 0 006 3.75c-1.05 0-2.06.18-3 .51v14.25A8.99 8.99 0 016 18c2.3 0 4.41.87 6 2.29m0-14.25a8.97 8.97 0 016-2.29c1.05 0 2.06.18 3 .51v14.25A8.99 8.99 0 0018 18a8.97 8.97 0 00-6 2.29m0-14.25v14.25',
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.24a2.25 2.25 0 01-1.07 1.92l-7.5 4.61a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.92V6.75',
  pin: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.14-7.5 11.25-7.5 11.25S4.5 17.64 4.5 10.5a7.5 7.5 0 1115 0z',
  check: 'M5 13l4 4L19 7',
  clock: 'M12 6v6l3.5 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  body: 'M12 4.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM5 7h14M12 7v6m0 0l-3 8m3-8l3 8',
  warn: 'M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78A1.5 1.5 0 0022.18 18L13.71 3.86a1.5 1.5 0 00-2.42 0z',
  x: 'M6 18L18 6M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  trash:
    'M14.74 9l-.35 9m-4.78 0L9.26 9m9.97-3.21c.34.05.68.1 1.02.16m-1.02-.16L18.16 19.67a2.25 2.25 0 01-2.24 2.08H8.08a2.25 2.25 0 01-2.24-2.08L4.77 5.79m14.46 0a48.1 48.1 0 00-3.48-.4m-12 .56c.34-.06.68-.11 1.02-.16m0 0a48.1 48.1 0 013.48-.4m7.5 0v-.92c0-1.18-.91-2.16-2.09-2.2a51.96 51.96 0 00-3.32 0c-1.18.04-2.09 1.02-2.09 2.2v.92m7.5 0a48.67 48.67 0 00-7.5 0',
  user: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.12a7.5 7.5 0 0115 0',
  key: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.03 5.91c-.56-.1-1.16.03-1.56.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.82c0-.6.24-1.17.66-1.59l6.4-6.4c.4-.4.53-1 .43-1.56A6 6 0 1121.75 8.25z',
  info: 'M11.25 11.25l.04-.02a.75.75 0 011.06.85l-.7 2.84a.75.75 0 001.06.85l.04-.02M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.01',
  arrowLeft: 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18',
  arrowRight: 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3',
  chevronLeft: 'M15.75 19.5L8.25 12l7.5-7.5',
  chevronRight: 'M8.25 4.5l7.5 7.5-7.5 7.5',
  play: 'M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z',
  grid: 'M4 13h6V4H4zm10 7h6v-9h-6zM4 20h6v-4H4zm10-11h6V4h-6z',
  list: 'M4 6h16M4 12h16M4 18h10',
  menu: 'M4 6h16M4 12h16M4 18h16',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
  chevronDown: 'M6 9l6 6 6-6',
  ban: 'M18.36 5.64A9 9 0 115.64 18.36 9 9 0 0118.36 5.64zM5.64 18.36L18.36 5.64',
  pause: 'M15.75 5.25v13.5m-7.5-13.5v13.5',
  soundOn:
    'M19.11 5.64a9 9 0 010 12.72M16.46 8.29a5.25 5.25 0 010 7.42M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.7-.51-1.94-1.35A9 9 0 012.25 12c0-.83.11-1.63.32-2.4.23-.85 1.06-1.35 1.94-1.35h2.24z',
  soundOff:
    'M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.7-.51-1.94-1.35A9 9 0 012.25 12c0-.83.11-1.63.32-2.4.23-.85 1.06-1.35 1.94-1.35h2.24z',
}

export default function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }) {
  if (name === 'play') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={PATHS.play} />
      </svg>
    )
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={PATHS[name]} />
    </svg>
  )
}

// Icon on a soft green square, used for feature lists and contact rows.
export function IconTile({ name, size = 'h-10 w-10', iconSize = 'h-5 w-5' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent ${size}`}>
      <Icon name={name} className={iconSize} />
    </span>
  )
}

export function PrivacyBand({ className = '' }) {
  return (
    <div className={`flex flex-col gap-4 rounded-lg border border-accent-mid bg-accent-soft p-5 sm:flex-row sm:items-start sm:gap-4 sm:p-6 ${className}`}>
      <Icon name="lock" className="h-5 w-5 shrink-0 text-accent-dark" />
      <div>
        <h3 className="text-[13px] font-medium text-accent-dark">Private by design</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
          Pose tracking runs entirely in your browser. Camera frames and body landmarks never leave your device. We only save the
          score, duration and notes you choose to submit.
        </p>
      </div>
    </div>
  )
}
