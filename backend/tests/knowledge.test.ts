import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sequelize } from "../src/config/database.js";
import { isCrawlDue } from "../src/jobs/knowledgeJob.js";
import { crawl, KNOWLEDGE_LOCK_KEY } from "../src/knowledge/crawler.js";
import { extractPage } from "../src/knowledge/extract.js";
import { isAllowed, parseRobots } from "../src/knowledge/robots.js";
import { search } from "../src/knowledge/search.js";
import {
  ALLOWED_HOSTS,
  isInSection,
  normalizeUrl,
  seeds,
} from "../src/knowledge/sources.js";
import { KnowledgeChunk } from "../src/models/KnowledgeChunk.js";
import { KnowledgePage } from "../src/models/KnowledgePage.js";
import { useLogs } from "./helpers/logs.js";

const logs = useLogs();

const MVA_URL =
  "https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/mva-melding/";
const mvaHtml = readFileSync("tests/fixtures/mvaPage.html", "utf8");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extracting a page", () => {
  const page = extractPage(mvaHtml, MVA_URL);

  it("takes the title from the main heading", () => {
    expect(page.title).toBe("Mva-melding");
  });

  it("splits the text at the headings and leaves out menus, footer and scripts", () => {
    expect(page.sections.map((s) => s.heading)).toEqual([
      "Mva-melding",
      "Frister for å levere mva-meldingen",
      "Slik leverer du",
    ]);
    const all = page.sections.map((s) => s.text).join(" ");
    expect(all).not.toContain("Postboks");
    expect(all).not.toContain("tracking");
    expect(all).not.toContain("Person");
  });

  it("keeps list items once each, marked as list items", () => {
    const deadlines = page.sections[1]?.text ?? "";
    expect(deadlines).toContain("- 1. termin (januar og februar): 10. april");
    expect(deadlines.match(/1\. termin/g)).toHaveLength(1);
  });

  it("leaves out sections too short to be useful", () => {
    expect(page.sections.some((s) => s.heading === "Kort")).toBe(false);
  });

  it("splits long sections between paragraphs", () => {
    const long = `<main><h1>T</h1>${Array.from({ length: 12 }, (_, i) => `<p>${`Avsnitt ${i} med tekst. `.repeat(12)}</p>`).join("")}</main>`;
    const sections = extractPage(long, MVA_URL).sections;

    expect(sections.length).toBeGreaterThan(1);
    expect(sections.every((s) => s.text.length <= 1200)).toBe(true);
  });

  it("reads the whole page when the content is not in <main> or <article>", () => {
    const page = extractPage(
      "<body><nav>Meny</nav><div class='content'><h1>Innsending av årsregnskap</h1><p>Alle regnskapspliktige må sende inn årsregnskapet senest 31. juli.</p></div><footer>Bunn</footer></body>",
      MVA_URL,
    );

    expect(page.title).toBe("Innsending av årsregnskap");
    expect(page.sections[0]?.text).toContain("senest 31. juli");
    expect(page.sections.map((s) => s.text).join(" ")).not.toContain("Meny");
  });

  it("reads the whole page when <main> is empty", () => {
    const page = extractPage(
      "<body><main></main><div><h1>Tittel</h1><p>Teksten står utenfor main-elementet på denne siden.</p></div></body>",
      MVA_URL,
    );

    expect(page.sections).toHaveLength(1);
  });

  it("gives the links as full addresses", () => {
    expect(page.links.map((link) => link.href)).toContain(
      `${MVA_URL}korrigere/`,
    );
  });

  it("gives the same hash for the same content", () => {
    expect(extractPage(mvaHtml, MVA_URL).hash).toBe(page.hash);
    expect(
      extractPage(mvaHtml.replace("seks ganger", "fem ganger"), MVA_URL).hash,
    ).not.toBe(page.hash);
  });
});

describe("robots.txt", () => {
  const text = `
User-agent: *
Disallow: /privat/
Allow: /privat/offentlig/
Disallow: /*.pdf$

User-agent: OtherBot
Disallow: /
`;

  it("follows the rules for every agent when there are none for ours", () => {
    const rules = parseRobots(text, "RegelvaktBot");

    expect(isAllowed(rules, "/bedrift-og-organisasjon/")).toBe(true);
    expect(isAllowed(rules, "/privat/side")).toBe(false);
    // The longer rule wins
    expect(isAllowed(rules, "/privat/offentlig/side")).toBe(true);
    expect(isAllowed(rules, "/veileder.pdf")).toBe(false);
  });

  it("follows the rules for our agent when there are some", () => {
    const rules = parseRobots(
      `${text}\nUser-agent: RegelvaktBot\nDisallow: /mva/\n`,
      "RegelvaktBot/1.0",
    );

    expect(isAllowed(rules, "/mva/side")).toBe(false);
    // The rules for every agent no longer apply
    expect(isAllowed(rules, "/privat/side")).toBe(true);
  });

  it("allows everything when it is empty", () => {
    expect(isAllowed(parseRobots("", "RegelvaktBot"), "/x")).toBe(true);
  });
});

describe("sources", () => {
  it("start from the obligations' own pages on official sites", () => {
    const urls = seeds().map((seed) => seed.url);

    expect(urls).toContain(MVA_URL);
    expect(urls.every((url) => url.startsWith("https://"))).toBe(true);
    // Every seed is on a site the crawler may read
    expect(
      seeds().every((seed) => ALLOWED_HOSTS.has(new URL(seed.url).host)),
    ).toBe(true);
  });

  it("follow links only within the seed's section", () => {
    const seed = new URL(MVA_URL);
    const link = (href: string) => new URL(href, seed);

    expect(isInSection(link("korrigere/"), seed)).toBe(true);
    expect(isInSection(link("../mva-satser/"), seed)).toBe(true);
    expect(isInSection(link("/person/"), seed)).toBe(false);
    expect(isInSection(link("https://www.example.com/x"), seed)).toBe(false);
    expect(isInSection(link("veileder.pdf"), seed)).toBe(false);
  });

  it("treat a page with a query or fragment as the same page", () => {
    expect(normalizeUrl(new URL(`${MVA_URL}?a=1#frister`))).toBe(MVA_URL);
  });
});

// A small fake web: robots.txt, the pages, and what each answers
function fakeWeb(pages: Record<string, () => Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith("/robots.txt")) {
      return new Response("User-agent: *\nDisallow: /privat/\n", {
        status: 200,
      });
    }
    const page = pages[url];
    if (page) return page();
    // Every other seed: a short page of its own
    const html = `<main><h1>Side ${url}</h1><p>Generell veiledning om plikter for næringsdrivende på denne siden.</p></main>`;
    return withUrl(
      new Response(html, { headers: { "content-type": "text/html" } }),
      url,
    );
  });
}

function withUrl(response: Response, url: string): Response {
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function html(body: string, url: string): () => Response {
  return () =>
    withUrl(
      new Response(body, {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
      url,
    );
}

describe("crawling", () => {
  const KORRIGERE = `${MVA_URL}korrigere/`;
  const korrigereHtml =
    "<main><h1>Korrigere mva-meldingen</h1><p>Du kan sende en ny mva-melding hvis du har gjort feil i en melding du har levert.</p><a href='/privat/x/'>Privat</a></main>";

  it("stores the seeds and the pages they link to in their section", async () => {
    const fetchMock = fakeWeb({
      [MVA_URL]: html(mvaHtml, MVA_URL),
      [KORRIGERE]: html(korrigereHtml, KORRIGERE),
    });

    const summary = await crawl();

    expect(summary?.failed).toBe(0);
    const mva = await KnowledgePage.findOne({ where: { url: MVA_URL } });
    expect(mva?.title).toBe("Mva-melding");
    expect(await KnowledgeChunk.count({ where: { pageId: mva?.id } })).toBe(3);
    expect(
      await KnowledgePage.findOne({ where: { url: KORRIGERE } }),
    ).not.toBeNull();
    // Off-site links and files were not fetched
    const fetched = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(fetched.some((url) => url.includes("example.com"))).toBe(false);
    expect(fetched.some((url) => url.endsWith(".pdf"))).toBe(false);
    // It said who it is
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("user-agent")).toMatch(
      /^RegelvaktBot\/1\.0 \(\+http:\/\/web\.test\)$/,
    );
  });

  it("leaves unchanged pages alone and replaces changed ones", async () => {
    fakeWeb({ [MVA_URL]: html(mvaHtml, MVA_URL) });
    await crawl();
    const before = await KnowledgeChunk.findAll({ order: [["id", "ASC"]] });

    vi.restoreAllMocks();
    fakeWeb({
      [MVA_URL]: html(mvaHtml.replace("seks ganger", "fem ganger"), MVA_URL),
    });
    const summary = await crawl();

    expect(summary?.changed).toBe(1);
    expect(summary?.added).toBe(0);
    expect(summary?.unchanged).toBeGreaterThan(0);
    const mva = await KnowledgePage.findOne({ where: { url: MVA_URL } });
    const texts = (await KnowledgeChunk.findAll({ where: { pageId: mva?.id } }))
      .map((c) => c.text)
      .join(" ");
    expect(texts).toContain("fem ganger");
    expect(before.length).toBe(await KnowledgeChunk.count());
  });

  it("takes out a page that is gone", async () => {
    fakeWeb({ [MVA_URL]: html(mvaHtml, MVA_URL) });
    await crawl();

    vi.restoreAllMocks();
    fakeWeb({ [MVA_URL]: () => new Response(null, { status: 404 }) });
    await crawl();

    expect(await KnowledgePage.findOne({ where: { url: MVA_URL } })).toBeNull();
  });

  it("reports a source link that leads nowhere", async () => {
    fakeWeb({ [MVA_URL]: () => new Response(null, { status: 404 }) });

    const summary = await crawl();

    // The page was never stored, but the broken link is still reported
    expect(summary?.missingSources).toEqual([MVA_URL]);
    const warning = logs.lines.find((l) =>
      l.msg?.startsWith("A source page does not exist"),
    );
    expect(warning?.url).toBe(MVA_URL);
    expect(logs.lines.at(-1)?.msg).toContain("1 missing sources");
  });

  it("says why a page without readable text was skipped", async () => {
    fakeWeb({
      [MVA_URL]: html(
        "<html><body><nav>Bare meny</nav></body></html>",
        MVA_URL,
      ),
    });

    const summary = await crawl();

    expect(summary?.skipped).toBeGreaterThan(0);
    expect(
      logs.lines.some(
        (l) => l.url === MVA_URL && l.reason === "no readable text",
      ),
    ).toBe(true);
  });

  it("keeps a page that could not be read this time", async () => {
    fakeWeb({ [MVA_URL]: html(mvaHtml, MVA_URL) });
    await crawl();

    vi.restoreAllMocks();
    fakeWeb({ [MVA_URL]: () => new Response(null, { status: 503 }) });
    const summary = await crawl();

    expect(summary?.failed).toBe(1);
    expect(
      await KnowledgePage.findOne({ where: { url: MVA_URL } }),
    ).not.toBeNull();
  });

  it("follows robots.txt and stays on the official sites", async () => {
    const fetchMock = fakeWeb({
      [MVA_URL]: html(
        mvaHtml.replace(
          'href="/bedrift-og-organisasjon/avgifter/mva/mva-melding/korrigere/"',
          'href="/privat/side/"',
        ),
        MVA_URL,
      ),
      [KORRIGERE]: () =>
        withUrl(
          new Response("<main><h1>X</h1></main>", {
            headers: { "content-type": "text/html" },
          }),
          "https://www.example.com/elsewhere",
        ),
    });

    await crawl();

    const fetched = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(fetched.some((url) => url.includes("/privat/"))).toBe(false);
  });

  it("skips what is not an HTML page", async () => {
    fakeWeb({
      [MVA_URL]: () =>
        withUrl(
          new Response("%PDF", {
            headers: { "content-type": "application/pdf" },
          }),
          MVA_URL,
        ),
    });

    const summary = await crawl();

    expect(summary?.skipped).toBeGreaterThan(0);
    expect(await KnowledgePage.findOne({ where: { url: MVA_URL } })).toBeNull();
  });

  it("stops between pages when asked to", async () => {
    fakeWeb({});
    const controller = new AbortController();
    controller.abort();

    const summary = await crawl(new Date(), controller.signal);

    expect(summary?.added).toBe(0);
  });

  it("does nothing while another update holds the lock", async () => {
    const fetchMock = fakeWeb({});
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked = () => {};
    const isLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const other = sequelize.transaction(async (transaction) => {
      await sequelize.query("SELECT pg_advisory_xact_lock(:key)", {
        replacements: { key: KNOWLEDGE_LOCK_KEY },
        transaction,
      });
      locked();
      await held;
    });
    await isLocked;

    const summary = await crawl();
    release();
    await other;

    expect(summary).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the weekly update", () => {
  const now = new Date("2026-11-26T08:00:00Z");

  it("runs when the knowledge base is empty or a week old", () => {
    expect(isCrawlDue(null, now)).toBe(true);
    expect(isCrawlDue(new Date("2026-11-19T08:00:00Z"), now)).toBe(true);
    expect(isCrawlDue(new Date("2026-11-20T08:00:00Z"), now)).toBe(false);
  });
});

describe("searching", () => {
  async function addPage(
    url: string,
    title: string,
    sections: [string, string][],
  ) {
    const page = await KnowledgePage.create({
      url,
      title,
      contentHash: "x".repeat(64),
      fetchedAt: new Date(),
    });
    await KnowledgeChunk.bulkCreate(
      sections.map(([heading, text], position) => ({
        pageId: page.id,
        position,
        heading,
        text,
      })),
    );
  }

  it("finds Norwegian words in other forms", async () => {
    await addPage(MVA_URL, "Mva-melding", [
      ["Frister", "Mva-meldingen leveres annenhver måned."],
    ]);

    const hits = await search(["mva-melding frist"]);

    expect(hits[0]?.url).toBe(MVA_URL);
    expect(hits[0]?.heading).toBe("Frister");
  });

  it("joins the terms with OR, ranking sections with more of them higher", async () => {
    await addPage("https://www.skatteetaten.no/a/", "A-melding", [
      ["A-melding", "A-meldingen leveres hver måned av arbeidsgivere."],
    ]);
    await addPage("https://www.skatteetaten.no/b/", "Arbeidsgiveravgift", [
      [
        "Betaling",
        "Arbeidsgiveravgift betales annenhver måned, og a-meldingen viser beløpet.",
      ],
    ]);

    const hits = await search(["a-melding", "arbeidsgiveravgift"]);

    expect(hits.map((hit) => hit.url)).toEqual([
      "https://www.skatteetaten.no/b/",
      "https://www.skatteetaten.no/a/",
    ]);
  });

  it("ranks sections about the company's own form higher", async () => {
    await addPage("https://www.skatteetaten.no/as/", "Skattemelding", [
      [
        "For aksjeselskap",
        "Skattemeldingen for aksjeselskap leveres innen 31. mai.",
      ],
    ]);
    await addPage("https://www.skatteetaten.no/enk/", "Skattemelding", [
      [
        "For enkeltpersonforetak",
        "Skattemeldingen for enkeltpersonforetak leveres innen 31. mai.",
      ],
    ]);

    const hits = await search(["skattemelding frist"], {
      boost: "aksjeselskap",
    });

    expect(hits[0]?.url).toBe("https://www.skatteetaten.no/as/");
  });

  it("takes at most two sections from one page", async () => {
    await addPage(
      MVA_URL,
      "Mva",
      [1, 2, 3, 4].map((i) => [
        `Mva ${i}`,
        `Mva-melding del ${i} om merverdiavgift.`,
      ]),
    );

    const hits = await search(["mva-melding"]);

    expect(hits).toHaveLength(2);
  });

  it("finds nothing for empty terms", async () => {
    expect(await search(["", "  "])).toEqual([]);
  });
});
