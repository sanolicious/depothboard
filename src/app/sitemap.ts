import type { MetadataRoute } from "next";
import { getRepository } from "@/lib/repository";
import { siteUrl } from "@/lib/format";

export default function sitemap(): MetadataRoute.Sitemap {
  const repo = getRepository();
  const staticRoutes = ["", "/rankings", "/athletes", "/calendar", "/records", "/shop", "/archive", "/claim", "/privacy", "/terms", "/cookies"].map((p) => ({
    url: siteUrl(p || "/"),
    lastModified: new Date(repo.getDb().asOf),
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  const athletes = repo.listAthletes({ includeMinors: false }).map((a) => ({
    url: siteUrl(`/athletes/${a.slug}`),
    lastModified: new Date(repo.getDb().asOf),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  const events = repo.listEvents().map((e) => ({
    url: siteUrl(`/events/${e.slug}`),
    lastModified: new Date(e.startDate),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));
  const dives = repo.listShowcaseDives().map((d) => ({
    url: siteUrl(`/dives/${d.id}`),
    lastModified: new Date(d.date),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  return [...staticRoutes, ...athletes, ...events, ...dives];
}
