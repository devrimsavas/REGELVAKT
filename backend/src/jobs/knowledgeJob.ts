// Keeps the assistant's knowledge base up to date: reads the official
// pages again when the last update is a week old, and at once when the
// knowledge base is empty (the first start). Checked every hour.
import { logger } from "../config/logger.js";
import { crawl, lastCrawl } from "../knowledge/crawler.js";

const log = logger.child({ module: "knowledge" });

const CHECK_MS = 60 * 60 * 1000;
export const REFRESH_AFTER_DAYS = 7;

let timer: NodeJS.Timeout | null = null;
let currentRun: Promise<void> | null = null;
let stopping = new AbortController();

// Whether the knowledge base should be read again now
export function isCrawlDue(last: Date | null, now: Date): boolean {
  return (
    last === null ||
    now.getTime() - last.getTime() >= REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000
  );
}

async function checkAndRun(): Promise<void> {
  try {
    if (!isCrawlDue(await lastCrawl(), new Date())) return;
    await crawl(new Date(), stopping.signal);
  } catch (error: unknown) {
    // Tried again at the next check
    log.error({ err: error }, "The knowledge base update failed");
  }
}

function check(): void {
  if (currentRun) return;
  currentRun = checkAndRun().finally(() => {
    currentRun = null;
  });
}

export function startKnowledgeJob(): void {
  if (timer) return;
  stopping = new AbortController();
  check();
  // unref: the timer alone does not keep the process running
  timer = setInterval(check, CHECK_MS);
  timer.unref();
}

// Stops the checks, and an update that is going on after the page it is
// reading, and waits for that
export async function stopKnowledgeJob(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  stopping.abort();
  await currentRun;
}
