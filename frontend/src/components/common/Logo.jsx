/**
 * Nudge brand marks — "n in motion".
 *
 * The two trailing lines are the whole idea: they turn a neutral lowercase `n`
 * into a letter being *nudged* forward. Keep them. They are also the motion
 * language for the rest of the app (rows slide 6px and settle).
 *
 * Geometry is fixed on a 512 grid; scale via the `size` prop, never by editing
 * the paths.
 */

const STROKE = 68;

/** Just the mark. `tone="brand"` uses the ember gradient; `tone="current"` inherits colour. */
export function Mark({ size = 32, tone = 'brand', title = 'Nudge', ...rest }) {
  // Unique gradient id so multiple marks can coexist on one page.
  const gid = `nudge-g-${tone}`;
  const stroke = tone === 'brand' ? `url(#${gid})` : 'currentColor';
  const trail = tone === 'brand' ? 'var(--ember-600)' : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      role="img"
      aria-label={title}
      {...rest}
    >
      {tone === 'brand' && (
        <defs>
          <linearGradient id={gid} x1="190" y1="150" x2="400" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--ember-400)" />
            <stop offset="1" stopColor="var(--ember-600)" />
          </linearGradient>
        </defs>
      )}
      <g
        stroke={stroke}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 232 372 L 232 248" />
        <path d="M 232 248 A 78 78 0 0 1 388 248 L 388 372" />
      </g>
      <g stroke={trail} strokeWidth={STROKE} strokeLinecap="round">
        <path d="M 118 214 L 150 214" opacity="0.34" />
        <path d="M 62 318 L 140 318" opacity="0.20" />
      </g>
    </svg>
  );
}

/**
 * The wordmark, drawn as vector geometry rather than set in a font — it renders
 * identically everywhere and carries no font-licensing baggage.
 * Metrics: x-height 100, stroke 19, bowl radius 31.
 */
export function Wordmark({ height = 22, color = 'currentColor', ...rest }) {
  const w = (height * 549) / 245;
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 549 245"
      fill="none"
      role="img"
      aria-label="Nudge"
      {...rest}
    >
      <g
        transform="translate(21.50,15.50)"
        fill="none"
        stroke={color}
        strokeWidth="19"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* n stem */}
        <path d="M 0.00 140.00 L 0.00 71.00" />
        <path d="M 0.00 71.00 A 31.00 31.00 0 1 1 62.00 71.00" />
        <path d="M 62.00 71.00 L 62.00 140.00" />
        {/* u stem */}
        <path d="M 111.00 40.00 L 111.00 109.00" />
        <path d="M 111.00 109.00 A 31.00 31.00 0 1 0 173.00 109.00" />
        <path d="M 173.00 40.00 L 173.00 140.00" />
        {/* d bowl */}
        <path d="M 222.00 109.00 A 31.00 31.00 0 1 1 284.00 109.00 A 31.00 31.00 0 1 1 222.00 109.00 Z" />
        <path d="M 284.00 6.00 L 284.00 140.00" />
        {/* g bowl */}
        <path d="M 333.00 109.00 A 31.00 31.00 0 1 1 395.00 109.00 A 31.00 31.00 0 1 1 333.00 109.00 Z" />
        <path d="M 395.00 40.00 L 395.00 183.20 A 24.80 24.80 0 0 1 359.04 190.14" />
        {/* e bar */}
        <path d="M 444.00 109.00 L 506.00 109.00" />
        <path d="M 506.00 109.00 A 31.00 31.00 0 1 0 495.74 132.04" />
      </g>
    </svg>
  );
}

/** Mark + wordmark, correctly aligned. The default app-header lockup. */
export function Logo({ size = 30, showWordmark = true, className = '' }) {
  return (
    <span
      className={`nudge-logo ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.34 }}
    >
      <Mark size={size} />
      {showWordmark && <Wordmark height={size * 0.62} color="var(--text-primary)" />}
    </span>
  );
}

export default Logo;
