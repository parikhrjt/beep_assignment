// posts.jsonl (git, source of truth) -> data/beep.db (SQLite + FTS5, read-only query engine baked into each deploy).
import { existsSync, readFileSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { ROLE_LABEL } from "../lib/taxonomy.ts";
import type { Post } from "./types.ts";

const src = new URL("../data/posts.jsonl", import.meta.url);
const out = fileURLToPath(new URL("../data/beep.db", import.meta.url));
const posts: Post[] = existsSync(src) ? readFileSync(src, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const jsonl = (name: string) => { const u = new URL(`../data/${name}`, import.meta.url); return existsSync(u) ? readFileSync(u, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []; };
const json = (name: string) => { const u = new URL(`../data/${name}`, import.meta.url); return existsSync(u) ? JSON.parse(readFileSync(u, "utf8")) : null; };

rmSync(out, { force: true });
const db = new DatabaseSync(out);
db.exec(`
PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;
CREATE TABLE posts (
  rid INTEGER PRIMARY KEY, id TEXT UNIQUE, title TEXT, company TEXT, role TEXT, cities TEXT, verdict TEXT, min_exp REAL,
  work_mode TEXT, employment TEXT, skills TEXT, pay TEXT, location_raw TEXT, text TEXT, url TEXT, apply_url TEXT,
  source TEXT, posted_at TEXT, first_seen TEXT, trust TEXT, receipts TEXT, tagger TEXT, model TEXT, prompt_v TEXT, dup_count INTEGER, live INTEGER
);
CREATE TABLE post_city (rid INTEGER, city TEXT);
CREATE INDEX ix_city ON post_city(city, rid);
CREATE INDEX ix_role ON posts(role); CREATE INDEX ix_live ON posts(live, posted_at);
CREATE VIRTUAL TABLE fts USING fts5(title, company, skills, role, cities, text, tokenize = 'porter unicode61 remove_diacritics 2');
CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
`);
const ins = db.prepare(`INSERT INTO posts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insC = db.prepare(`INSERT INTO post_city VALUES (?,?)`);
const insF = db.prepare(`INSERT INTO fts(rowid,title,company,skills,role,cities,text) VALUES (?,?,?,?,?,?,?)`);
db.exec("BEGIN");
posts.forEach((p, i) => {
  const t = p.tags, rid = i + 1;
  ins.run(rid, p.id, p.title, p.company, t.role, JSON.stringify(t.cities), t.verdict, t.min_exp_years, t.work_mode, t.employment, JSON.stringify(t.skills), t.pay, p.location_raw, p.text, p.url, p.apply_url,
    p.source, p.posted_at ?? p.first_seen, p.first_seen, t.trust, JSON.stringify(t.receipts), t.tagger, t.model, t.prompt_v, p.dup_count, t.verdict === "experienced" ? 0 : 1);
  for (const c of t.cities) insC.run(rid, c);
  insF.run(rid, p.title, p.company, t.skills.join(" "), ROLE_LABEL[t.role] ?? t.role, t.cities.join(" "), p.text);
});
const runs = jsonl("runs.jsonl");
const meta = db.prepare(`INSERT INTO meta VALUES (?,?)`);
meta.run("built_at", new Date().toISOString());
meta.run("last_run", JSON.stringify(runs.at(-1) ?? null));
meta.run("runs", JSON.stringify(runs.slice(-30)));
meta.run("eval", JSON.stringify({ holdout: json("eval-holdout.json"), dev: json("eval-dev.json") }));
db.exec("COMMIT; INSERT INTO fts(fts) VALUES('optimize'); VACUUM;");
db.close();
console.log(`beep.db built: ${posts.length} posts (${posts.filter((p) => p.tags.verdict !== "experienced").length} live)`);
