// Full-text search in the knowledge base, in Norwegian: words are reduced
// to their stem, so "mva-meldingen" also finds "mva-melding". Every word of
// every search term is joined with OR, so a section does not need all of
// them to be found. Sections that match more of the search terms come
// first; among those, PostgreSQL's ranking (more matches, matches in the
// heading) decides.
import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export interface SearchHit {
  url: string;
  title: string;
  heading: string;
  text: string;
  rank: number;
}

export interface SearchOptions {
  limit?: number;
  // Sections with this term rank higher, e.g. "aksjeselskap" for an AS
  boost?: string | null;
}

// At most this many sections from one page, so the answer draws on more
// than one page when it can
const MAX_PER_PAGE = 2;

export async function search(
  terms: string[],
  options: SearchOptions = {},
): Promise<SearchHit[]> {
  const cleaned = [
    ...new Set(terms.map((term) => term.trim()).filter(Boolean)),
  ].slice(0, 8);
  if (cleaned.length === 0) return [];

  const replacements: Record<string, unknown> = {
    limit: options.limit ?? 6,
    perPage: MAX_PER_PAGE,
    boost: options.boost ?? "",
  };
  // plainto_tsquery joins a term's words with AND; they become OR
  const termQueries = cleaned.map((term, index) => {
    replacements[`t${index}`] = term;
    return `replace(plainto_tsquery('norwegian', :t${index})::text, '&', '|')::tsquery`;
  });
  const query = termQueries.join(" || ");
  // How many of the terms a section matches
  const coverage = termQueries
    .map((termQuery) => `(c.search @@ ${termQuery})::int`)
    .join(" + ");

  return sequelize.query<SearchHit>(
    `
    WITH q AS (SELECT (${query}) AS query),
    hits AS (
      SELECT p.url, p.title, c.heading, c.text,
        ${coverage} AS coverage,
        ts_rank_cd(c.search, q.query, 32) *
          CASE WHEN :boost <> '' AND c.search @@ plainto_tsquery('norwegian', :boost)
            THEN 1.3 ELSE 1 END AS rank,
        row_number() OVER (
          PARTITION BY c.page_id
          ORDER BY ${coverage} DESC, ts_rank_cd(c.search, q.query, 32) DESC
        ) AS on_page
      FROM knowledge_chunks c
      JOIN knowledge_pages p ON p.id = c.page_id, q
      WHERE c.search @@ q.query
    )
    SELECT url, title, heading, text, rank FROM hits
    WHERE on_page <= :perPage
    ORDER BY coverage DESC, rank DESC
    LIMIT :limit
    `,
    { replacements, type: QueryTypes.SELECT },
  );
}
