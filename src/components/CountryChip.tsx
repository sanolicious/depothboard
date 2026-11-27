import { flagEmoji } from "@/lib/country-flags";

export function CountryChip({
  code,
  neutral,
  title,
  showCode = true,
}: {
  code: string;
  neutral?: boolean;
  title?: string;
  /** When false, render only the flag (code stays in title / sr-only). */
  showCode?: boolean;
}) {
  const flag = neutral ? null : flagEmoji(code);
  const label = title ?? (neutral ? "Neutral Athlete" : code);
  const showText = showCode || !flag;

  return (
    <span
      className={`cc${neutral ? " cc--n" : ""}${flag ? " cc--flag" : ""}`}
      title={label}
    >
      {flag ? (
        <span className="cc__flag" aria-hidden="true">
          {flag}
        </span>
      ) : null}
      {showText ? (
        <span className="cc__code">{code}</span>
      ) : (
        <span className="sr-only">{code}</span>
      )}
    </span>
  );
}
