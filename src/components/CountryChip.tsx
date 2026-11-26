export function CountryChip({
  code,
  neutral,
  title,
}: {
  code: string;
  neutral?: boolean;
  title?: string;
}) {
  return (
    <span
      className={`cc${neutral ? " cc--n" : ""}`}
      title={title ?? (neutral ? "Neutral Athlete" : code)}
    >
      {code}
    </span>
  );
}
