import type { Metadata, Viewport } from "next";
import "./depthboard.css";
import "./globals.css";
import {
  BottomNav,
  CookieBanner,
  LiveBar,
  SiteFooter,
  SiteHeader,
} from "@/components/SiteChrome";
import { JsonLd } from "@/components/JsonLd";
import { fmtDate, siteUrl } from "@/lib/format";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Depthboard · Freediving results, records and footage",
    template: "%s · Depthboard",
  },
  description:
    "Official AIDA and CMAS freediving results, rankings, records and Diveye footage in one place.",
  applicationName: "Depthboard",
  authors: [{ name: "Diveye / Depthboard" }],
  openGraph: {
    type: "website",
    siteName: "Depthboard",
    title: "Depthboard · Freediving results, records and footage",
    description:
      "Official AIDA and CMAS freediving results, rankings, records and Diveye footage.",
    url: siteUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: "Depthboard",
    description: "Freediving results, records and footage.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1c1c1c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const repo = getRepository();
  const live = repo.listEvents({ status: "live", limit: 1 })[0];
  const featuredEvents = (
    live
      ? [live]
      : repo.listEvents({ sort: "desc", limit: 2 })
  ).map((e) => ({
    slug: e.slug,
    shortName: e.shortName,
    hint: `${e.venue} · ${fmtDate(e.startDate)}`,
  }));
  const featuredAthletes = repo
    .getRanking({
      board: "PORTAL",
      sex: "M",
      disc: "OVERALL",
      scope: "active",
      metric: "points",
    })
    .slice(0, 3)
    .map((r) => ({
      slug: r.athlete.slug,
      name: r.athlete.name,
      country: r.athlete.country,
      hint: `World #${r.pos} · Men`,
    }));

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Depthboard",
            url: siteUrl(),
            description:
              "Freediving results, records and footage from AIDA and CMAS.",
            potentialAction: {
              "@type": "SearchAction",
              target: `${siteUrl("/archive")}?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }}
        />
        {live && (
          <LiveBar
            event={{
              slug: live.slug,
              shortName: live.shortName,
              day: live.day,
              ofDays: live.ofDays,
              disciplines: live.disciplines,
              venue: live.venue,
            }}
          />
        )}
        <SiteHeader
          featuredAthletes={featuredAthletes}
          featuredEvents={featuredEvents}
        />
        <main id="main">{children}</main>
        <SiteFooter />
        <BottomNav />
        <CookieBanner />
      </body>
    </html>
  );
}
