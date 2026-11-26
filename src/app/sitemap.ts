import type { MetadataRoute } from "next";
import { listDiveCenters } from "@/lib/centers";
import { getRepository } from "@/lib/repository";
import { siteUrl } from "@/lib/format";

export default function sitemap(): MetadataRoute.Sitemap {
  const repo = getRepository();
  const asOf = new Date(repo.getDb().asOf);
  const staticRoutes = [
    "",
    "/rankings",
    "/athletes",
    "/calendar",
    "/centers",
    "/records",
    "/shop",
    "/archive",
    "/coaching",
    "/claim",
    "/privacy",
    "/terms",
    "/cookies",
  ].map((p) => ({
    url: siteUrl(p || "/"),
    lastModified: asOf,
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : 0.7,
  }));

  const centers = listDiveCenters().map((c) => ({
    url: siteUrl(`/centers/${c.slug}`),
    lastModified: asOf,
    changeFrequency: "weekly" as const,
    priority: 0.55,
  }));

  // Cap URL count so sitemap stays practical with the full real seed.
  const athletes = repo
    .getRanking({
      board: "PORTAL",
      sex: "M",
      disc: "OVERALL",
      scope: "active",
      metric: "points",
    })
    .slice(0, 200)
    .map((r) => ({
      url: siteUrl(`/athletes/${r.athlete.slug}`),
      lastModified: asOf,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  const events = repo.listEvents({ sort: "desc", limit: 200 }).map((e) => ({
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

  return [...staticRoutes, ...centers, ...athletes, ...events, ...dives];
}
