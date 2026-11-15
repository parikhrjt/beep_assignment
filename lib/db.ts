import { DatabaseSync } from "node:sqlite";
import path from "node:path";

// One read-only handle per function instance. The DB file ships inside the deployment, so there is
// no network hop, no connection pool and no cold DB to wake: the "database" scales with the functions.
let _db: DatabaseSync | null = null;
export function db(): DatabaseSync {
  if (!_db) _db = new DatabaseSync(path.join(process.cwd(), "data", "beep.db"), { readOnly: true });
  return _db;
}
export const meta = <T = any>(k: string): T | null => {
  const r = db().prepare("SELECT v FROM meta WHERE k = ?").get(k) as { v: string } | undefined;
  if (!r) return null;
  try { return JSON.parse(r.v) as T; } catch { return r.v as unknown as T; }
};
