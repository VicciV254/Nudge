/**
 * Icon set — monoline, 24px grid, round caps and joins.
 * Deliberately matches the logo's construction (same stroke language), so the
 * UI and the mark feel like one system.
 */

const PATHS = {
  check: <path d="M4 12.5 9.5 18 20 6.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  bell: (
    <>
      <path d="M18 10a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M10.5 21a2 2 0 0 0 3 0" />
    </>
  ),
  sync: (
    <>
      <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8" />
      <path d="M3 20v-5h5M21 4v5h-5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 22 20H2z" />
      <path d="M12 10v4.5M12 17.6v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13h5l2 3h4l2-3h5" />
      <path d="M5.5 5h13l2.5 8v6H3v-6z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8M19.1 19.1l-1.8-1.8M6.7 6.7 4.9 4.9" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  trash: (
    <>
      <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z" />
      <path d="M14.5 6.5 17.5 9.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  google: (
    <>
      <path d="M21 12.2c0-.7-.06-1.35-.18-2H12v3.8h5.05a4.3 4.3 0 0 1-1.87 2.82v2.35h3.02C19.96 17.5 21 15.1 21 12.2z" />
      <path d="M12 21.5c2.53 0 4.65-.84 6.2-2.28l-3.02-2.35c-.84.56-1.9.9-3.18.9-2.44 0-4.5-1.65-5.24-3.87H3.64v2.42A9.36 9.36 0 0 0 12 21.5z" />
      <path d="M6.76 13.9a5.6 5.6 0 0 1 0-3.6V7.88H3.64a9.36 9.36 0 0 0 0 8.44z" />
      <path d="M12 6.44c1.38 0 2.61.47 3.58 1.4l2.68-2.68C16.64 3.66 14.52 2.7 12 2.7a9.36 9.36 0 0 0-8.36 5.18l3.12 2.42C7.5 8.08 9.56 6.44 12 6.44z" />
    </>
  ),
  flame: (
    <path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.6.7-3 1.6-4.1.3 1 1 1.9 1.9 2.3C10.2 8 11 5.4 12 3z" />
  ),
};

export default function Icon({ name, size = 18, strokeWidth = 2, className = '', ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {d}
    </svg>
  );
}
