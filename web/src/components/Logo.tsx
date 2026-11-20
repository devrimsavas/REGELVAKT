// The Regelvakt mark: a shield (protection) with a check mark (obligations
// met). Colors come from the theme, so it works in light and dark mode.
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={(size * 23) / 27}
      height={size}
      viewBox="4.5 2.5 23 27"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16 2.5 27.5 6.5v8.6c0 7.1-4.8 12.6-11.5 14.4C9.3 27.7 4.5 22.2 4.5 15.1V6.5Z"
        fill="var(--ds-color-accent-base-default)"
      />
      <path
        d="m10.5 15.6 3.8 3.8 7.4-7.6"
        fill="none"
        stroke="var(--ds-color-accent-base-contrast-default)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-text">Regelvakt</span>
    </span>
  );
}
