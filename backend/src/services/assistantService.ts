// The assistant: answers a question about the obligations from the
// official pages in the knowledge base, with numbered sources.
//
// 1. The language model turns the question into Norwegian search terms, so
//    a question in English or in everyday words ("KDV", "skatt på salg")
//    still finds the official wording ("mva", "merverdiavgift").
// 2. Full-text search finds the most relevant sections.
// 3. The model answers only from its sources and marks each claim with the
//    number of its source. Source [1] is always Regelvakt's own rules (see
//    rulesSource.ts): the dates come from there, the explanations from the
//    official pages, [2] onwards.
// Without a language model (none set up, or it fails), the answer is the
// most relevant sections themselves, with their links.

import { createHash } from "node:crypto";
import { logger } from "../config/logger.js";
import { type SearchHit, search } from "../knowledge/search.js";
import type { EmailLanguage } from "../models/Subscription.js";
import type { Company } from "../types/company.js";
import { createLlmProvider } from "./llm/llmProvider.js";
import type { LlmProvider } from "./llm/types.js";
import type { RulesSource } from "./rulesSource.js";

const log = logger.child({ module: "assistant" });

// Official sections per answer, besides the rules. Kept small so the
// sources fit in a local model's context window.
const SOURCES_PER_ANSWER = 5;
const EXCERPT_CHARS = 280;

export interface Source {
  number: number;
  // "rules": Regelvakt's own rules; "page": a section of an official page
  kind: "rules" | "page";
  title: string;
  heading: string;
  // null for the general rules, which have no page of their own
  url: string | null;
  excerpt: string;
  // The answer refers to this source
  cited: boolean;
}

export interface AssistantAnswer {
  // "answer": written by the language model; "sources": the most relevant
  // sections only, because no model is set up or it could not answer
  mode: "answer" | "sources";
  answer: string | null;
  sources: Source[];
  disclaimer: string;
}

// The company the question is about, from an assessment, to rank the
// sources that fit it higher and to tell the model what kind it is
export interface CompanyContext {
  organizationForm: string;
  vatRegistered: boolean;
}

export function companyContext(company: Company): CompanyContext {
  return {
    organizationForm: company.organizationForm,
    vatRegistered: company.vatRegistered,
  };
}

const TEXT = {
  nb: {
    disclaimer: {
      answer:
        "Svaret er laget av en språkmodell ut fra Skatteetatens og Brønnøysundregistrenes sider. Det er ikke skatte- eller regnskapsrådgivning, og det kan inneholde feil. Sjekk alltid kilden.",
      sources:
        "Dette er utdrag fra Skatteetatens og Brønnøysundregistrenes sider. Det er ikke skatte- eller regnskapsrådgivning. Les hele siden før du gjør noe.",
    },
    notFound:
      "Jeg fant ikke noe om dette i de offisielle sidene jeg har. Prøv å spørre med andre ord, eller se skatteetaten.no.",
  },
  en: {
    disclaimer: {
      answer:
        "The answer is written by a language model from the pages of the Norwegian Tax Administration and the Brønnøysund Register Centre. It is not tax or accounting advice and may contain mistakes. Always check the source.",
      sources:
        "These are excerpts from the pages of the Norwegian Tax Administration and the Brønnøysund Register Centre. They are not tax or accounting advice. Read the whole page before you act.",
    },
    notFound:
      "I found nothing about this in the official pages I have. Try other words, or see skatteetaten.no.",
  },
} as const;

const FORM_TERM: Record<string, string> = {
  ENK: "enkeltpersonforetak",
  AS: "aksjeselskap",
};

function describeCompany(context: CompanyContext): string {
  const form =
    context.organizationForm === "ENK"
      ? "et enkeltpersonforetak (ENK)"
      : context.organizationForm === "AS"
        ? "et aksjeselskap (AS)"
        : `en virksomhet med organisasjonsform ${context.organizationForm}`;
  const vat = context.vatRegistered
    ? "registrert i Merverdiavgiftsregisteret"
    : "ikke registrert i Merverdiavgiftsregisteret";
  return `Spørsmålet gjelder ${form} som er ${vat}.`;
}

// ---- 1. Search terms ----

const TERMS_PROMPT = `Du lager søkeord for å finne svar i Skatteetatens og Brønnøysundregistrenes veiledning for næringsdrivende.
Gjør spørsmålet om til 2–6 korte søkeuttrykk på norsk bokmål, med de ordene veiledningen selv bruker (for eksempel "mva-melding", "forskuddsskatt", "a-melding", "årsregnskap").
Ta ikke med navn, tall eller andre personopplysninger fra spørsmålet.
Svar bare med JSON: {"terms": ["...", "..."]}`;

export async function searchTerms(
  question: string,
  provider: LlmProvider | null,
): Promise<string[]> {
  if (!provider) return [question];
  try {
    const raw = await provider.chat({
      messages: [
        { role: "system", content: TERMS_PROMPT },
        { role: "user", content: question },
      ],
      json: true,
    });
    const parsed: unknown = JSON.parse(raw);
    const terms =
      typeof parsed === "object" &&
      parsed !== null &&
      "terms" in parsed &&
      Array.isArray(parsed.terms)
        ? parsed.terms.filter(
            (term): term is string =>
              typeof term === "string" && term.length <= 80,
          )
        : [];
    // The question itself is searched too, in case the terms miss
    return [...terms.slice(0, 6), question];
  } catch (error: unknown) {
    log.warn(
      { err: error },
      "Could not make search terms; searching the question",
    );
    return [question];
  }
}

// ---- 3. The answer ----

function answerPrompt(language: EmailLanguage, context: CompanyContext | null) {
  return [
    "Du er Regelvakt, en veiviser for små virksomheter i Norge.",
    "Svar på spørsmålet bare ut fra kildene under. Bruk ikke annen kunnskap.",
    "Kilde [1] er Regelvakts regler. Ta datoer og frister fra [1]. Bruk de andre kildene til å forklare.",
    "En dato i [1] kan være flyttet fra en helg eller helligdag; da står den opprinnelige datoen i parentes. Det er ikke en motstrid med en kilde som oppgir den opprinnelige datoen.",
    "Oppgir en annen kilde en annen dato enn [1] for det samme, si fra om det og vis til begge kildene.",
    "Gjelder spørsmålet en plikt med flere mulige frister, nevn alle fristene som kan gjelde.",
    "Sett kildens nummer i hakeparentes etter hver opplysning, for eksempel [1] eller [2][3].",
    "Står svaret ikke i kildene, si det kort og foreslå å se skatteetaten.no. Gjett aldri frister, beløp eller regler.",
    "Svar kort og enkelt, uten fagsjargong: høyst 6 setninger eller en kort liste.",
    "Gi ikke råd om hva brukeren bør gjøre i sin egen sak; fortell hva kildene sier.",
    "Be ikke om personopplysninger.",
    language === "en"
      ? "Answer in English, even though the sources are in Norwegian."
      : "Svar på norsk bokmål.",
    ...(context ? [describeCompany(context)] : []),
  ].join("\n");
}

// The rules as [1], the sections as [2] onwards
function sourcesBlock(rules: RulesSource, hits: SearchHit[]): string {
  return [
    `[1] ${rules.title} – ${rules.heading}\n${rules.text}`,
    ...hits.map(
      (hit, index) =>
        `[${index + 2}] ${hit.title} – ${hit.heading}\n${hit.url}\n${hit.text}`,
    ),
  ].join("\n\n");
}

// The source numbers the answer refers to, among those it was given
export function citedNumbers(answer: string, count: number): Set<number> {
  const numbers = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const number = Number(match[1]);
    if (number >= 1 && number <= count) numbers.add(number);
  }
  return numbers;
}

// Removes references to sources that do not exist, such as [9] when there
// were six. A list in one bracket, "[1, 3]", is split into "[1][3]" first:
// models write it both ways.
function withoutUnknownSources(answer: string, count: number): string {
  return answer
    .replace(/\[(\d+(?:\s*,\s*\d+)+)\]/g, (_whole, list: string) =>
      list
        .split(",")
        .map((number) => `[${number.trim()}]`)
        .join(""),
    )
    .replace(/\[(\d+)\]/g, (whole, number: string) =>
      Number(number) >= 1 && Number(number) <= count ? whole : "",
    )
    .replace(/ +([.,;:])/g, "$1")
    .trim();
}

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= EXCERPT_CHARS) return flat;
  const cut = flat.slice(0, EXCERPT_CHARS);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)} …`;
}

// The sections, numbered from `first`
function pageSources(
  hits: SearchHit[],
  cited: Set<number>,
  first: number,
): Source[] {
  return hits.map((hit, index) => ({
    number: first + index,
    kind: "page",
    title: hit.title,
    heading: hit.heading,
    url: hit.url,
    excerpt: excerpt(hit.text),
    cited: cited.has(first + index),
  }));
}

function rulesSourceItem(rules: RulesSource, cited: Set<number>): Source {
  return {
    number: 1,
    kind: "rules",
    title: rules.title,
    heading: rules.heading,
    url: rules.url,
    excerpt: rules.excerpt,
    cited: cited.has(1),
  };
}

// ---- All of it ----

export interface Question {
  question: string;
  language: EmailLanguage;
  context: CompanyContext | null;
  // Source [1]: the company's or the general rules
  rules: RulesSource;
}

export async function ask(input: Question): Promise<AssistantAnswer> {
  const t = TEXT[input.language];
  const provider = createLlmProvider();

  const terms = await searchTerms(input.question, provider);
  const hits = await search(terms, {
    limit: SOURCES_PER_ANSWER,
    boost: input.context
      ? (FORM_TERM[input.context.organizationForm] ?? null)
      : null,
  });

  if (hits.length === 0) {
    const mode = provider ? "answer" : "sources";
    return {
      mode,
      answer: t.notFound,
      sources: [],
      disclaimer: t.disclaimer[mode],
    };
  }

  if (provider) {
    try {
      const raw = await provider.chat({
        messages: [
          {
            role: "system",
            content: answerPrompt(input.language, input.context),
          },
          {
            role: "user",
            content: `Kilder:\n\n${sourcesBlock(input.rules, hits)}\n\nSpørsmål: ${input.question}`,
          },
        ],
      });
      const count = hits.length + 1;
      const answer = withoutUnknownSources(raw, count);

      if (answer) {
        const cited = citedNumbers(answer, count);
        return {
          mode: "answer",
          answer,
          sources: [
            rulesSourceItem(input.rules, cited),
            ...pageSources(hits, cited, 2),
          ],
          disclaimer: t.disclaimer.answer,
        };
      }
      // The question is not logged; the length tells an empty answer from
      // one that only held unknown source numbers
      log.warn(
        { provider: provider.name, rawLength: raw.length },
        "The language model gave an empty answer; showing the sources",
      );
    } catch (error: unknown) {
      // The question itself is not logged: it may hold personal details
      log.error(
        { err: error, provider: provider.name },
        "The language model could not answer; showing the sources",
      );
    }
  }

  return {
    mode: "sources",
    answer: null,
    sources: pageSources(hits, new Set(), 1),
    disclaimer: t.disclaimer.sources,
  };
}

// ---- Answer cache and daily limit ----

// The same question about the same kind of company gets the same answer
// for an hour, without asking the model again
const CACHE_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { expires: number; answer: AssistantAnswer }>();

// The rules text is part of the key: a company's next deadlines change
// with its answers and with the date, the general rules never do
function cacheKey(input: Question): string {
  const question = input.question.toLowerCase().replace(/\s+/g, " ").trim();
  const context = input.context
    ? `${input.context.organizationForm}:${input.context.vatRegistered}`
    : "-";
  const rules = createHash("sha256").update(input.rules.text).digest("hex");
  return `${input.language}|${context}|${rules}|${question}`;
}

export class DailyLimitError extends Error {}

// ask() with the cache and the daily limit. A question answered from the
// cache does not count towards the limit.
export async function askCached(
  input: Question,
  today: string,
): Promise<AssistantAnswer> {
  const key = cacheKey(input);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.answer;

  if (!takeDailyQuestion(today)) {
    throw new DailyLimitError("The daily question limit is reached");
  }
  const answer = await ask(input);
  // Only real answers are kept; a fallback is tried again next time
  if (answer.mode === "answer" || !createLlmProvider()) {
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { expires: now + CACHE_MS, answer });
  }
  return answer;
}

// How many questions the assistant answers in a day, for everybody
// together: a ceiling on what the language model can cost
const DEFAULT_DAILY_LIMIT = 500;
let day = "";
let asked = 0;

function dailyLimit(): number {
  const value = Number(process.env.ASSISTANT_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
}

// Counts a question; false when today's limit is reached
function takeDailyQuestion(today: string): boolean {
  if (today !== day) {
    day = today;
    asked = 0;
  }
  if (asked >= dailyLimit()) return false;
  asked++;
  return true;
}

// For tests
export function resetAssistant(): void {
  cache.clear();
  day = "";
  asked = 0;
}
