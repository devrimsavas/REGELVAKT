// Builds and refreshes the assistant's knowledge base from the official
// pages in sources.ts. Polite by design: robots.txt is followed, one
// request per CRAWL_DELAY_MS (1 second by default) to each site, and the
// crawler says who it is in its User-Agent.
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { logger } from "../config/logger.js";
import { KnowledgeChunk } from "../models/KnowledgeChunk.js";
import { KnowledgePage } from "../models/KnowledgePage.js";
import { webAppUrl } from "../utils/webAppUrl.js";
import { extractPage } from "./extract.js";
import { isAllowed, parseRobots, type RobotsRules } from "./robots.js";
import {
  ALLOWED_HOSTS,
  isInSection,
  MAX_LINKED_PAGES_PER_SEED,
  MAX_PAGES,
  normalizeUrl,
  seeds,
} from "./sources.js";

const log = logger.child({ module: "knowledge" });

export const CRAWLER_NAME = "RegelvaktBot";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_DELAY_MS = 1000;
// Pages that have not been seen in this long are taken out
const DROP_UNSEEN_AFTER_DAYS = 30;

export const KNOWLEDGE_LOCK_KEY = 7_364_021;

function userAgent(): string {
  return `${CRAWLER_NAME}/1.0 (+${webAppUrl()})`;
}

function delayMs(): number {
  const value = Number(process.env.CRAWL_DELAY_MS);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DELAY_MS;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FetchResult =
  | { status: "ok"; url: string; html: string }
  | { status: "gone" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

// Fetches politely: waits its turn for the site, and keeps to pages
class Fetcher {
  private readonly lastRequest = new Map<string, number>();
  private readonly robots = new Map<string, RobotsRules | null>();

  private async wait(host: string): Promise<void> {
    const last = this.lastRequest.get(host);
    const delay = delayMs();
    if (last !== undefined) {
      const left = last + delay - Date.now();
      if (left > 0) await sleep(left);
    }
    this.lastRequest.set(host, Date.now());
  }

  private async request(url: string): Promise<Response> {
    const host = new URL(url).host;
    await this.wait(host);
    return fetch(url, {
      headers: { "User-Agent": userAgent(), Accept: "text/html,text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  // The site's robots.txt rules. A missing file allows everything; a site
  // that cannot be asked is not read in this run (null).
  private async rulesFor(origin: string): Promise<RobotsRules | null> {
    if (this.robots.has(origin)) return this.robots.get(origin) ?? null;
    let rules: RobotsRules | null;
    try {
      const response = await this.request(`${origin}/robots.txt`);
      if (response.ok) {
        rules = parseRobots(await response.text(), CRAWLER_NAME);
      } else if (response.status >= 400 && response.status < 500) {
        rules = { allow: [], disallow: [] };
      } else {
        rules = null;
      }
    } catch {
      rules = null;
    }
    this.robots.set(origin, rules);
    return rules;
  }

  async page(url: string): Promise<FetchResult> {
    const parsed = new URL(url);
    const rules = await this.rulesFor(parsed.origin);
    if (rules === null) {
      return { status: "failed", reason: "robots.txt could not be read" };
    }
    if (!isAllowed(rules, parsed.pathname)) {
      return { status: "skipped", reason: "not allowed by robots.txt" };
    }

    let response: Response;
    try {
      response = await this.request(url);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      return { status: "failed", reason };
    }

    if (response.status === 404 || response.status === 410) {
      return { status: "gone" };
    }
    if (!response.ok) {
      return { status: "failed", reason: `HTTP ${response.status}` };
    }
    // A redirect must not take the crawler off the official sites
    const finalUrl = new URL(response.url || url);
    if (!ALLOWED_HOSTS.has(finalUrl.host)) {
      return { status: "skipped", reason: "redirected off the allowed sites" };
    }
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) {
      return { status: "skipped", reason: "not an HTML page" };
    }
    const length = Number(response.headers.get("content-length"));
    if (length > MAX_PAGE_BYTES) {
      return { status: "skipped", reason: "too large" };
    }
    const html = await response.text();
    if (html.length > MAX_PAGE_BYTES) {
      return { status: "skipped", reason: "too large" };
    }
    return { status: "ok", url: normalizeUrl(finalUrl), html };
  }
}

export interface CrawlSummary {
  added: number;
  changed: number;
  unchanged: number;
  removed: number;
  skipped: number;
  failed: number;
  // Seeds that answered 404 or 410: a source link in the rules is broken,
  // and users who follow it get no page either
  missingSources: string[];
}

// Stores a page and its sections; an unchanged page only gets a new date
async function store(
  url: string,
  html: string,
  now: Date,
): Promise<{
  result: "added" | "changed" | "unchanged" | "empty";
  links: URL[];
}> {
  const page = extractPage(html, url);
  if (page.sections.length === 0) return { result: "empty", links: page.links };

  const existing = await KnowledgePage.findOne({ where: { url } });
  if (existing && existing.contentHash === page.hash) {
    await existing.update({ fetchedAt: now });
    return { result: "unchanged", links: page.links };
  }

  await sequelize.transaction(async (transaction) => {
    const stored = existing
      ? await existing.update(
          { title: page.title, contentHash: page.hash, fetchedAt: now },
          { transaction },
        )
      : await KnowledgePage.create(
          { url, title: page.title, contentHash: page.hash, fetchedAt: now },
          { transaction },
        );
    await KnowledgeChunk.destroy({ where: { pageId: stored.id }, transaction });
    await KnowledgeChunk.bulkCreate(
      page.sections.map((section, position) => ({
        pageId: stored.id,
        position,
        heading: section.heading.slice(0, 300),
        text: section.text,
      })),
      { transaction },
    );
  });
  return { result: existing ? "changed" : "added", links: page.links };
}

// Reads every seed and the pages they link to in their section, and keeps
// the knowledge base in step: new and changed pages are stored, pages that
// are gone are taken out. Returns null when another crawl is going on.
// An aborted signal stops it between two pages (the server shutting down);
// the next update goes on from where the pages stand.
export async function crawl(
  now = new Date(),
  signal?: AbortSignal,
): Promise<CrawlSummary | null> {
  return sequelize.transaction(async (transaction) => {
    const [row] = await sequelize.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock(:key) AS locked",
      {
        replacements: { key: KNOWLEDGE_LOCK_KEY },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    if (!row?.locked) {
      log.warn(
        "Another knowledge base update is going on; this one does nothing",
      );
      return null;
    }

    const summary: CrawlSummary = {
      added: 0,
      changed: 0,
      unchanged: 0,
      removed: 0,
      skipped: 0,
      failed: 0,
      missingSources: [],
    };
    const fetcher = new Fetcher();
    const done = new Set<string>();

    const visit = async (url: string, isSeed: boolean): Promise<URL[]> => {
      done.add(url);
      const fetched = await fetcher.page(url);
      if (fetched.status === "gone") {
        summary.removed += await KnowledgePage.destroy({ where: { url } });
        if (isSeed) {
          summary.missingSources.push(url);
          log.warn(
            { url },
            "A source page does not exist (404/410): correct the link in the rules or sources",
          );
        }
        return [];
      }
      if (fetched.status === "skipped") {
        summary.skipped++;
        log.info({ url, reason: fetched.reason }, "Page skipped");
        return [];
      }
      if (fetched.status === "failed") {
        summary.failed++;
        log.warn({ url, reason: fetched.reason }, "Page could not be read");
        return [];
      }
      done.add(fetched.url);
      const { result, links } = await store(fetched.url, fetched.html, now);
      if (result === "empty") {
        summary.skipped++;
        log.info(
          { url: fetched.url, reason: "no readable text" },
          "Page skipped",
        );
      } else {
        summary[result]++;
      }
      return links;
    };

    const stop = () => done.size >= MAX_PAGES || signal?.aborted === true;

    for (const seed of seeds()) {
      if (stop()) break;
      const seedUrl = normalizeUrl(new URL(seed.url));
      if (done.has(seedUrl)) continue;
      const links = await visit(seedUrl, true);
      if (!seed.followLinks) continue;

      const section = new URL(seedUrl);
      const linked = [
        ...new Set(
          links
            .filter((link) => isInSection(link, section))
            .map((link) => normalizeUrl(link)),
        ),
      ]
        .filter((url) => !done.has(url))
        .slice(0, MAX_LINKED_PAGES_PER_SEED);

      for (const url of linked) {
        if (stop()) break;
        if (!done.has(url)) await visit(url, false);
      }
    }

    if (signal?.aborted) {
      log.info(summary, "Knowledge base update stopped early");
      return summary;
    }

    // Pages no longer reached from the seeds (moved or unlinked)
    summary.removed += await KnowledgePage.destroy({
      where: {
        fetchedAt: {
          [Op.lt]: new Date(
            now.getTime() - DROP_UNSEEN_AFTER_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      },
    });

    log.info(
      summary,
      `Knowledge base: ${summary.added} added, ${summary.changed} changed, ${summary.unchanged} unchanged, ${summary.removed} removed, ${summary.skipped} skipped, ${summary.failed} failed, ${summary.missingSources.length} missing sources`,
    );
    return summary;
  });
}

// When the knowledge base was last brought up to date; null when empty
export async function lastCrawl(): Promise<Date | null> {
  const latest: unknown = await KnowledgePage.max("fetchedAt");
  return latest instanceof Date ? latest : null;
}
