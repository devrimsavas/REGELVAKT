// Turns an HTML page into its title and sections of plain text. Menus,
// headers, footers and scripts are left out; each heading starts a new
// section, and long sections are split between paragraphs.
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

export interface Section {
  heading: string;
  text: string;
}

export interface ExtractedPage {
  title: string;
  sections: Section[];
  // SHA-256 of the sections, to see whether the page has changed
  hash: string;
  // The page's links, made absolute
  links: URL[];
}

// Sections are kept short enough that the answer can quote the right part
const MAX_SECTION_CHARS = 1200;
// Shorter sections carry too little to be found or to answer with
const MIN_SECTION_CHARS = 40;

const LEFT_OUT =
  "script, style, noscript, template, nav, header, footer, aside, form, svg, button, iframe, [aria-hidden='true'], [hidden]";

const BLOCKS = "h1, h2, h3, h4, p, li, td, th, dt, dd, blockquote, pre";

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Splits a long section between paragraphs; a single paragraph that is
// still too long is split between sentences
function split(heading: string, paragraphs: string[]): Section[] {
  const sections: Section[] = [];
  let current = "";
  const pieces = paragraphs.flatMap((p) =>
    p.length <= MAX_SECTION_CHARS ? [p] : (p.match(/[^.!?]+[.!?]*\s*/g) ?? [p]),
  );

  for (const piece of pieces) {
    const next = current ? `${current}\n${piece.trim()}` : piece.trim();
    if (next.length > MAX_SECTION_CHARS && current) {
      sections.push({ heading, text: current });
      current = piece.trim();
    } else {
      current = next;
    }
  }
  if (current) sections.push({ heading, text: current });
  return sections;
}

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  const links: URL[] = [];
  $("a[href]").each((_, element) => {
    try {
      links.push(new URL($(element).attr("href") ?? "", pageUrl));
    } catch {
      // Not a usable link
    }
  });

  $(LEFT_OUT).remove();

  // The page's own content: <main> or <article> when there is one with
  // text, otherwise the whole <body> (menus and footers are removed above)
  const candidates = [$("main").first(), $("article").first(), $("body")];
  const root =
    candidates.find(
      (candidate) => candidate.length > 0 && clean(candidate.text()).length > 0,
    ) ?? $("body");

  const title =
    clean(root.find("h1").first().text()) ||
    clean($("h1").first().text()) ||
    clean($("title").first().text()).replace(/\s+[-|–].*$/, "") ||
    pageUrl;

  const sections: Section[] = [];
  let heading = title;
  let paragraphs: string[] = [];
  const flush = () => {
    const text = paragraphs.join("\n");
    if (text.length >= MIN_SECTION_CHARS) {
      sections.push(...split(heading, paragraphs));
    }
    paragraphs = [];
  };

  root.find(BLOCKS).each((_, element) => {
    const node = $(element);
    const tag = element.tagName.toLowerCase();
    if (/^h[1-4]$/.test(tag)) {
      flush();
      heading = clean(node.text()) || heading;
      return;
    }
    // Text inside a block that is itself kept (a paragraph in a list item)
    // is part of that block already
    if (node.parents("p, li, td, th, dt, dd, blockquote, pre").length > 0) {
      return;
    }
    const text = clean(node.text());
    if (text) paragraphs.push(tag === "li" ? `- ${text}` : text);
  });
  flush();

  const hash = createHash("sha256")
    .update(JSON.stringify([title, sections]))
    .digest("hex");

  return { title: title.slice(0, 300), sections, hash, links };
}
