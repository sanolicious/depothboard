import { existsSync, readFileSync } from "fs";
import path from "path";
import type { OrderStub } from "@/types/domain";

let cached: OrderStub[] | null = null;

export function listOrdersForUser(userId: string): OrderStub[] {
  if (!cached) {
    const file = path.join(process.cwd(), "data", "orders-stub.json");
    if (!existsSync(file)) {
      cached = [];
    } else {
      try {
        const parsed = JSON.parse(readFileSync(file, "utf8")) as OrderStub[];
        cached = Array.isArray(parsed) ? parsed : [];
      } catch {
        cached = [];
      }
    }
  }
  return cached.filter((o) => o.userId === userId);
}
