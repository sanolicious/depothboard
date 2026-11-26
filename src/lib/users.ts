import { existsSync, readFileSync } from "fs";
import path from "path";
import type { DemoUser, SessionUser } from "@/types/domain";

let cached: DemoUser[] | null = null;

export function loadUsers(): DemoUser[] {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "users.json");
  if (!existsSync(file)) {
    cached = [];
    return cached;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as DemoUser[];
    cached = Array.isArray(parsed) ? parsed : [];
  } catch {
    cached = [];
  }
  return cached;
}

export function invalidateUsersCache(): void {
  cached = null;
}

export function findUserByEmail(email: string): DemoUser | undefined {
  const needle = email.trim().toLowerCase();
  return loadUsers().find((u) => u.email.toLowerCase() === needle);
}

export function getUserById(id: string): DemoUser | undefined {
  return loadUsers().find((u) => u.id === id);
}

export function toPublicUser(user: DemoUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    athleteSlug: user.athleteSlug ?? null,
  };
}

export function listDemoAccounts(): Array<{
  email: string;
  password: string;
  name: string;
  role: DemoUser["role"];
  athleteSlug: string | null;
  notes?: string;
}> {
  return loadUsers().map((u) => ({
    email: u.email,
    password: u.password,
    name: u.name,
    role: u.role,
    athleteSlug: u.athleteSlug ?? null,
    notes: u.notes,
  }));
}
