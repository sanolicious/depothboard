import type { Card, Performance } from "@/types/domain";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

export function fmtValue(disc: string, v: number): string {
  if (disc === "STA") {
    const m = Math.floor(v / 60);
    const s = v % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }
  const rounded = Math.round(v * 2) / 2;
  return `${String(rounded).replace(/\.0$/, "")} m`;
}

export function fmtPoints(p: number): string {
  const s = (Math.round(p * 10) / 10).toString();
  const [whole, frac] = s.split(".");
  const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  return frac !== undefined ? `${withSep}.${frac}` : withSep;
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function cardLabel(card: Card): string {
  if (card === "W") return "White card, valid dive";
  if (card === "Y") return "Yellow card, penalty";
  return "Red card, disqualified";
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

export function resultDisplay(p: Pick<Performance, "card" | "rp" | "discipline">): string {
  if (p.card === "R") return "DQ";
  return fmtValue(p.discipline, p.rp);
}

export function siteUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://depthboard.com";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
