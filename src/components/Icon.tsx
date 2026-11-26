import type { SVGProps } from "react";

const PATHS: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  "chev-r": '<path d="m9 6 6 6-6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M3 15h18M8 5v14M16 5v14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a3 3 0 0 0 3 3M16 6h4v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v10h14V10"/>',
  rank: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 21h4"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2.2 2.2L15 10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
  flag: '<path d="M5 21V4M5 5h12l-2 4 2 4H5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  eye: '<path d="M2.5 12c1-2 4.5-6 9.5-6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6Z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off":
    '<path d="M3 3l18 18M10.6 6.2A9 9 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-3 3.6M6.5 7.6A14 14 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.6 0 3-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
};

export function Icon({
  name,
  className = "",
  filled = false,
  ...rest
}: {
  name: string;
  filled?: boolean;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "name">) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg
      className={`icon${filled ? " icon--fill" : ""} ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
      {...rest}
    />
  );
}

export function DiverIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`icon icon--fill ${className}`.trim()}
      viewBox="0 0 22 58"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 0h8L8.2 10H5.4L1.5 0Zm11 0h8l-3.9 10h-2.8L12.5 0Z" />
      <rect x="7.2" y="8" width="3" height="14" rx="1.5" />
      <rect x="11.8" y="8" width="3" height="14" rx="1.5" />
      <rect x="6" y="19" width="10" height="19" rx="5" />
      <rect x="9.6" y="34" width="2.8" height="16" rx="1.4" />
      <circle cx="11" cy="53.5" r="3.6" />
    </svg>
  );
}
