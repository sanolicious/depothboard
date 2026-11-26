import Link from "next/link";
import { Icon } from "@/components/Icon";

type Props = {
  icon?: string;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({
  icon = "info",
  title,
  body,
  actionHref,
  actionLabel,
}: Props) {
  return (
    <div className="empty card" style={{ padding: "40px 24px" }}>
      <Icon name={icon} />
      <h2 style={{ fontSize: "1.25rem", color: "var(--text)" }}>{title}</h2>
      <p className="muted" style={{ maxWidth: 420 }}>
        {body}
      </p>
      {actionHref && actionLabel && (
        <Link className="btn btn--primary btn--sm" href={actionHref}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
