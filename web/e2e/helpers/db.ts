import { createRequire } from "node:module";
import path from "node:path";
import { E2E_DB } from "../../playwright.config";

// The pg package of the API (backend/), so the web app needs no database
// driver of its own just for the tests
// (Playwright loads the tests as CommonJS, so __dirname is there)
const requireFromApi = createRequire(
  path.join(__dirname, "../../../backend/package.json"),
);
interface PgClient {
  connect(): Promise<void>;
  query(text: string, values?: unknown[]): Promise<unknown>;
  end(): Promise<void>;
}
const { Client } = requireFromApi("pg") as {
  Client: new (config: Record<string, unknown>) => PgClient;
};

async function withClient<T>(work: (client: PgClient) => Promise<T>): Promise<T> {
  const client = new Client({
    host: E2E_DB.DB_HOST,
    port: Number(E2E_DB.DB_PORT),
    database: E2E_DB.DB_NAME,
    user: E2E_DB.DB_USER,
    password: E2E_DB.DB_PASSWORD,
  });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

// A small knowledge base for the assistant: two official sections about
// the VAT return. The API reads the official pages only when its weekly
// update runs, which is off in the tests.
export async function seedKnowledgeBase(): Promise<void> {
  await withClient(async (client) => {
    await client.query("DELETE FROM knowledge_pages");
    await client.query(
      `INSERT INTO knowledge_pages (id, url, title, content_hash, fetched_at, created_at, updated_at) VALUES
       ('11111111-1111-4111-8111-111111111111', 'https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/levere-mva-meldingen/', 'Mva-melding', $1, now(), now(), now()),
       ('22222222-2222-4222-8222-222222222222', 'https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/betale-mva/arstermin/', 'Årstermin for små virksomheter', $2, now(), now(), now())`,
      ["a".repeat(64), "b".repeat(64)],
    );
    await client.query(
      `INSERT INTO knowledge_chunks (id, page_id, position, heading, text) VALUES
       ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 0, 'Frister for å levere mva-meldingen', 'Mva-meldingen leveres annenhver måned. Fristen for januar og februar er 10. april. Du må levere mva-melding selv om omsetningen er null.'),
       ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 0, 'Frist for innsending av mva-melding', 'Frist for innsending av mva-melding er 10. mars (gjelder deg som har søkt om og fått innvilget årstermin).')`,
    );
  });
}
