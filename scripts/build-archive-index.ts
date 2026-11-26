/**
 * Offline archive index builder (Diveye S2.2).
 *
 * Usage:
 *   npm run archive:index
 *   OPENAI_API_KEY=… npm run archive:index   # optional LLM polish
 *
 * Writes data/archive-index.json from FootageAsset markers + seed dive metadata.
 */

import { rebuildArchiveIndex } from "../src/lib/archive-index";

async function main() {
  const enrich = Boolean(process.env.OPENAI_API_KEY?.trim());
  const result = await rebuildArchiveIndex({ enrich });
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  const { index } = result;
  console.log(
    `Wrote ${index.momentCount} moments → data/archive-index.json (engine=${index.engine}, asOf=${index.asOf})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
