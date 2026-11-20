import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { KnowledgeChunk } from "../src/models/KnowledgeChunk.js";
import { KnowledgePage } from "../src/models/KnowledgePage.js";
import {
  citedNumbers,
  relevantDeadlines,
} from "../src/services/assistantService.js";
import { GeminiProvider } from "../src/services/llm/geminiProvider.js";
import {
  createLlmProvider,
  setLlmProvider,
} from "../src/services/llm/llmProvider.js";
import { OllamaProvider } from "../src/services/llm/ollamaProvider.js";
import {
  type ChatRequest,
  type LlmProvider,
  LlmQuotaError,
  LlmResponseError,
  LlmTimeoutError,
  LlmUnavailableError,
} from "../src/services/llm/types.js";
import {
  createAssessment,
  enkAnswers,
  enkEnhet,
} from "./helpers/assessments.js";
import { useLogs } from "./helpers/logs.js";

const logs = useLogs();

const MVA_URL =
  "https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/mva-melding/";
const AS_URL =
  "https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/skattemelding-naringsdrivende/selskap/";

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

// A language model that answers what the test says, and remembers what it
// was asked
function fakeModel(answers: { terms?: string[]; answer?: string | Error }) {
  const requests: ChatRequest[] = [];
  const model: LlmProvider = {
    name: "fake:model",
    timeoutMs: 60_000,
    async chat(request) {
      requests.push(request);
      if (request.json) {
        return JSON.stringify({ terms: answers.terms ?? [] });
      }
      if (answers.answer instanceof Error) throw answers.answer;
      return answers.answer ?? "";
    },
  };
  setLlmProvider(model);
  return requests;
}

let nextAddress = 1;
function ask(body: object, address = `198.18.0.${nextAddress++}`) {
  return request(app)
    .post("/api/assistant/ask")
    .set("X-Forwarded-For", address)
    .send(body);
}

beforeEach(async () => {
  await addPage(MVA_URL, "Mva-melding", [
    [
      "Frister for å levere mva-meldingen",
      "De fleste leverer mva-meldingen annenhver måned. Fristen for 1. termin er 10. april.",
    ],
    [
      "Slik leverer du",
      "Du kan levere mva-meldingen fra regnskapssystemet ditt.",
    ],
  ]);
  await addPage(AS_URL, "Skattemelding for selskap", [
    [
      "Frist for aksjeselskap",
      "Aksjeselskap leverer skattemeldingen innen 31. mai, fra et regnskapssystem.",
    ],
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/assistant/ask with a language model", () => {
  it("answers from the sources and marks the ones it used", async () => {
    const requests = fakeModel({
      terms: ["mva-melding frist"],
      answer:
        "Mva-meldingen leveres annenhver måned [2]. Første frist er 10. april [1].",
    });

    const res = await ask({ question: "Når må jeg levere KDV?" });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("answer");
    expect(res.body.answer).toContain("annenhver måned [2]");
    // The dates are in the answer itself
    expect(res.body.deadlines).toEqual([]);
    expect(res.body.sources[0]).toMatchObject({
      number: 1,
      kind: "rules",
      url: null,
      cited: true,
    });
    expect(res.body.sources[1]).toMatchObject({
      number: 2,
      kind: "page",
      url: MVA_URL,
      heading: "Frister for å levere mva-meldingen",
      cited: true,
    });
    expect(res.body.disclaimer).toContain("språkmodell");
    // The model was given the rules as [1], the sections from [2], and the
    // question
    const prompt = requests[1]?.messages.at(-1)?.content ?? "";
    expect(prompt).toContain("[1] Regelvakt – Pliktene og fristene");
    expect(prompt).toContain(
      `[2] Mva-melding – Frister for å levere mva-meldingen\n${MVA_URL}`,
    );
    expect(prompt).toContain("Spørsmål: Når må jeg levere KDV?");
  });

  it("finds the official wording through the model's search terms", async () => {
    fakeModel({ terms: ["mva-melding"], answer: "Se kilden [1]." });

    // The question's own words are in none of the pages
    const res = await ask({ question: "What about sales tax?" });

    expect(res.body.sources.map((s: { url: string }) => s.url)).toContain(
      MVA_URL,
    );
  });

  it("removes references to sources it was not given", async () => {
    fakeModel({
      terms: ["mva-melding"],
      answer: "Fristen er 10. april [2][9].",
    });

    const res = await ask({ question: "Når er fristen for mva?" });

    expect(res.body.answer).toBe("Fristen er 10. april [2].");
  });

  it("reads a list of sources in one bracket", async () => {
    fakeModel({
      terms: ["mva-melding"],
      answer: "Fristen er 10. april [1, 2, 9].",
    });

    const res = await ask({ question: "Når er mva-fristen?" });

    expect(res.body.answer).toBe("Fristen er 10. april [1][2].");
    expect(res.body.sources[1]).toMatchObject({ number: 2, cited: true });
  });

  it("answers in English when asked", async () => {
    const requests = fakeModel({
      terms: ["mva-melding"],
      answer: "Every two months [1].",
    });

    const res = await ask({
      question: "When is the VAT return due?",
      language: "en",
    });

    expect(res.body.disclaimer).toContain("language model");
    expect(requests[1]?.messages[0]?.content).toContain("Answer in English");
  });

  it("tells the model about the company and ranks its sources higher", async () => {
    const assessment = await createAssessment({
      enhet: {
        ...enkEnhet,
        organisasjonsform: { kode: "AS", beskrivelse: "Aksjeselskap" },
      },
      answers: { vatTerm: "bimonthly", paysSalary: false },
    });
    const requests = fakeModel({ terms: ["frist"], answer: "31. mai [1]." });

    const res = await ask({
      question: "Hva er fristen?",
      assessmentId: assessment.id,
    });

    expect(res.body.sources[1].url).toBe(AS_URL);
    expect(requests[1]?.messages[0]?.content).toContain("aksjeselskap (AS)");
  });

  it("gives the sources when the model cannot answer, without logging the question", async () => {
    fakeModel({
      terms: ["mva-melding"],
      answer: new LlmResponseError("Gemini answered 400: bad request"),
    });

    const res = await ask({
      question: "Mitt fødselsnummer er 01019912345, når leverer jeg mva?",
    });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("sources");
    expect(res.body.reason).toBe("modelFailed");
    expect(res.body.answer).toBeNull();
    expect(res.body.sources[0].cited).toBe(false);
    expect(res.body.disclaimer).toContain("utdrag");
    expect(logs.raw.join("")).toContain("could not answer");
    expect(logs.raw.join("")).not.toContain("01019912345");
  });

  it("says when the model's quota is used up, and asks again next time", async () => {
    const requests = fakeModel({
      terms: ["mva-melding"],
      answer: new LlmQuotaError("Gemini answered 429: quota"),
    });

    const res = await ask({ question: "Når leverer jeg mva?" });

    expect(res.body.mode).toBe("sources");
    expect(res.body.reason).toBe("modelQuota");
    expect(logs.raw.join("")).toContain("quota is used up");
    // A fallback is not kept: the same question asks the model again
    await ask({ question: "Når leverer jeg mva?" });
    expect(requests).toHaveLength(4);
  });

  it("asks the model once per question when search terms are off", async () => {
    vi.stubEnv("ASSISTANT_SEARCH_TERMS", "off");
    const requests = fakeModel({
      terms: ["x"],
      answer: "Annenhver måned [2].",
    });

    const res = await ask({ question: "mva-meldingen frister" });

    expect(res.body.mode).toBe("answer");
    expect(res.body.reason).toBeNull();
    expect(res.body.sources[1].url).toBe(MVA_URL);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.json).toBeUndefined();
  });

  it("shares the model's time limit between the steps of one question", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    const requests: ChatRequest[] = [];
    setLlmProvider({
      name: "fake:slow",
      timeoutMs: 60_000,
      async chat(request) {
        requests.push(request);
        if (request.json) {
          // The search terms take 15 seconds
          vi.setSystemTime(Date.now() + 15_000);
          return JSON.stringify({ terms: ["mva-melding"] });
        }
        return "Annenhver måned [2].";
      },
    });

    try {
      await ask({ question: "Når leverer jeg mva-meldingen?" });
    } finally {
      vi.useRealTimers();
    }

    // At most a third for the search terms, the rest for the answer
    expect(requests[0]?.timeoutMs).toBe(20_000);
    expect(requests[1]?.timeoutMs).toBe(45_000);
  });

  it("searches the question itself when the search terms cannot be made", async () => {
    const model: LlmProvider = {
      name: "fake:broken",
      timeoutMs: 60_000,
      async chat(request) {
        if (request.json) return "not json";
        return "Annenhver måned [1].";
      },
    };
    setLlmProvider(model);

    const res = await ask({ question: "mva-meldingen frister" });

    expect(res.body.mode).toBe("answer");
    expect(res.body.sources[1].url).toBe(MVA_URL);
  });

  it("says so when nothing is found, without asking the model", async () => {
    const requests = fakeModel({ terms: ["fiskekvoter"], answer: "x" });

    const res = await ask({ question: "Hvor mye torsk kan jeg fiske?" });

    expect(res.body.sources).toEqual([]);
    expect(res.body.answer).toContain("fant ikke");
    // Only the search terms were asked for
    expect(requests).toHaveLength(1);
  });

  it("asks the model once for the same question within an hour", async () => {
    const requests = fakeModel({
      terms: ["mva-melding"],
      answer: "Annenhver måned [1].",
    });

    await ask({ question: "Når leverer jeg mva-melding?" });
    await ask({ question: "  når leverer jeg   MVA-melding? " });

    expect(requests).toHaveLength(2);
  });
});

describe("POST /api/assistant/ask with the rules as source [1]", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives the model every obligation's deadlines when there is no assessment", async () => {
    const requests = fakeModel({ terms: ["mva-melding"], answer: "Se [1]." });

    await ask({ question: "Når må jeg levere mva-meldingen?" });

    const system = requests[1]?.messages[0]?.content ?? "";
    const prompt = requests[1]?.messages.at(-1)?.content ?? "";
    expect(system).toContain("Ta datoer og frister fra [1]");
    expect(system).toContain("si fra om det og vis til begge kildene");
    expect(system).toContain("Det er ikke en motstrid");
    expect(prompt).toContain("mai–juni innen 31. august");
    expect(prompt).toContain("Årstermin: innen 10. mars året etter");
    expect(prompt).toContain("Gjelder: Alle som betaler lønn.");
  });

  it("gives the model the company's obligations and next deadlines, without its name", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    const assessment = await createAssessment();
    const requests = fakeModel({
      terms: ["mva-melding"],
      answer: "Neste frist er 10. desember 2026 [1].",
    });

    const res = await ask({
      question: "Når er neste frist for mva?",
      assessmentId: assessment.id,
    });

    const prompt = requests[1]?.messages.at(-1)?.content ?? "";
    expect(prompt).toContain("Enkeltpersonforetak (ENK), registrert i");
    expect(prompt).toContain(
      "Fristene de neste tolv månedene: 10. desember 2026, 10. februar 2027, 12. april 2027 (flyttet fra lørdag 10. april),",
    );
    // All obligations' next deadlines together, so "the next deadline" is
    // read from one line
    expect(prompt).toContain(
      "De neste fristene for foretaket, alle plikter samlet, den første først: 10. desember 2026 (Mva-melding);",
    );
    expect(prompt).toContain("Leverer mva-melding annenhver måned");
    // Only the company's own term, not the annual one
    expect(prompt).not.toContain("Årstermin: innen 10. mars");
    // Not an obligation of a sole proprietorship that pays no salary
    expect(prompt).not.toContain("A-melding\n");
    expect(prompt).not.toContain(enkEnhet.navn);
    expect(res.body.sources[0]).toMatchObject({
      kind: "rules",
      url: `http://web.test/assessments/${assessment.id}`,
      heading: "Pliktene og fristene for dette foretaket",
      cited: true,
    });
  });

  it("asks the model again when the same question is about a company with other answers", async () => {
    const bimonthly = await createAssessment();
    const annual = await createAssessment({
      answers: { ...enkAnswers, vatTerm: "annual" },
    });
    const requests = fakeModel({ terms: ["mva-melding"], answer: "Se [1]." });

    await ask({ question: "Når er fristen?", assessmentId: bimonthly.id });
    await ask({ question: "Når er fristen?", assessmentId: annual.id });

    // Search terms and an answer for each
    expect(requests).toHaveLength(4);
    expect(requests[3]?.messages.at(-1)?.content).toContain(
      "én gang i året (årstermin)",
    );
  });
});

describe("POST /api/assistant/ask without a language model", () => {
  it("gives the most relevant official sections with their links", async () => {
    const res = await ask({ question: "Når må mva-meldingen leveres?" });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("sources");
    expect(res.body.reason).toBe("noModel");
    expect(res.body.answer).toBeNull();
    expect(res.body.sources[0]).toMatchObject({
      number: 1,
      kind: "page",
      url: MVA_URL,
      cited: false,
    });
    expect(res.body.sources[0].excerpt.length).toBeLessThanOrEqual(282);
    // The rules are not a source here: their deadlines come on their own
    expect(
      res.body.sources.every((s: { kind: string }) => s.kind === "page"),
    ).toBe(true);
    expect(res.body.deadlines).toEqual([
      {
        title: "Mva-melding",
        text: expect.stringContaining(
          "januar–februar innen 10. april, mars–april innen 10. juni",
        ),
      },
    ]);
  });

  it("gives the deadlines in English when asked", async () => {
    const res = await ask({
      question: "When is the VAT return due?",
      language: "en",
    });

    expect(res.body.deadlines).toEqual([
      {
        title: "VAT return",
        text: expect.stringContaining("January–February by 10 April"),
      },
    ]);
  });

  it("gives a company's own next dates, for its obligations only", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    try {
      const assessment = await createAssessment();

      const vat = await ask({
        question: "Når er neste frist for mva-meldingen?",
        assessmentId: assessment.id,
      });
      expect(vat.body.deadlines).toEqual([
        {
          title: "Mva-melding",
          text: "De neste fristene: 10. desember 2026, 10. februar 2027, 12. april 2027.",
        },
      ]);

      // The sole proprietorship pays no salaries: no a-melding to show
      const aMelding = await ask({
        question: "Når må a-meldingen leveres?",
        assessmentId: assessment.id,
      });
      expect(aMelding.body.deadlines).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("deadlines without the model", () => {
  const obligations = [
    {
      id: "vat-return",
      title: "Mva-melding",
      text: "Annenhver måned.",
      sourceUrl: MVA_URL,
    },
    {
      id: "tax-return-company",
      title: "Skattemelding for selskap",
      text: "Innen 31. mai.",
      sourceUrl: AS_URL,
    },
  ];
  const hit = (url: string) => ({
    url,
    title: "Side",
    heading: "Del",
    text: "Tekst",
  });

  it("are the obligations the question names", () => {
    expect(
      relevantDeadlines("Hva koster MVA?", [hit(AS_URL)], obligations),
    ).toEqual([{ title: "Mva-melding", text: "Annenhver måned." }]);
    expect(
      relevantDeadlines("When is the company tax return due?", [], obligations),
    ).toEqual([{ title: "Skattemelding for selskap", text: "Innen 31. mai." }]);
  });

  it("are the obligations of the first pages found when it names none", () => {
    expect(
      relevantDeadlines(
        "Hvordan leverer jeg?",
        [hit("https://example.no/"), hit(AS_URL)],
        obligations,
      ),
    ).toEqual([{ title: "Skattemelding for selskap", text: "Innen 31. mai." }]);
    // Further down the list does not count
    expect(
      relevantDeadlines(
        "Hvordan leverer jeg?",
        [
          hit("https://example.no/a"),
          hit("https://example.no/b"),
          hit(MVA_URL),
        ],
        obligations,
      ),
    ).toEqual([]);
  });
});

describe("POST /api/assistant/ask limits and errors", () => {
  it("lists every problem with the input", async () => {
    const res = await ask({
      question: "x",
      language: "de",
      assessmentId: "abc",
    });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      "question must be between 3 and 500 characters",
      "language must be one of: nb, en",
      "assessmentId must be an assessment id",
    ]);
  });

  it("answers 404 for an unknown assessment", async () => {
    const res = await ask({
      question: "Når leverer jeg mva?",
      assessmentId: "6f1c2a8e-3b7d-4c1e-9a2f-5d8e7b6c4a31",
    });

    expect(res.status).toBe(404);
  });

  it("answers 503 while the knowledge base is empty", async () => {
    await KnowledgePage.destroy({ where: {} });

    const res = await ask({ question: "Når leverer jeg mva?" });

    expect(res.status).toBe(503);
  });

  it("stops at the daily limit for everybody together", async () => {
    vi.stubEnv("ASSISTANT_DAILY_LIMIT", "2");

    expect((await ask({ question: "Spørsmål en om mva" })).status).toBe(200);
    expect((await ask({ question: "Spørsmål to om mva" })).status).toBe(200);
    const third = await ask({ question: "Spørsmål tre om mva" });

    expect(third.status).toBe(429);
    expect(third.body.error).toContain("today");
    // A question already answered still comes from the cache
    expect((await ask({ question: "Spørsmål en om mva" })).status).toBe(200);
  });

  it("limits the questions from one address", async () => {
    vi.stubEnv("ASSISTANT_QUESTIONS_PER_ADDRESS", "1");
    const address = "198.18.1.1";

    expect((await ask({ question: "Første om mva" }, address)).status).toBe(
      200,
    );
    expect((await ask({ question: "Andre om mva" }, address)).status).toBe(429);
  });
});

describe("GET /api/assistant/status", () => {
  it("tells whether the assistant is ready and which model it uses", async () => {
    fakeModel({});

    const res = await request(app).get("/api/assistant/status");

    expect(res.body).toMatchObject({
      ready: true,
      knowledgeBase: { pages: 2, sections: 3 },
      model: "fake:model",
      freeTier: false,
    });
  });

  it("tells when Gemini is used on its free tier", async () => {
    setLlmProvider(undefined);
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.6-flash");

    expect(
      (await request(app).get("/api/assistant/status")).body.freeTier,
    ).toBe(false);
    vi.stubEnv("GEMINI_FREE_TIER", "true");
    expect(
      (await request(app).get("/api/assistant/status")).body.freeTier,
    ).toBe(true);
    // Only Gemini has this free tier
    vi.stubEnv("AI_PROVIDER", "ollama");
    vi.stubEnv("OLLAMA_MODEL", "qwen3");
    expect(
      (await request(app).get("/api/assistant/status")).body.freeTier,
    ).toBe(false);
  });
});

describe("citations", () => {
  it("are the source numbers the answer uses, among those it had", () => {
    expect([...citedNumbers("A [1], B [2][3] og C [7].", 6)]).toEqual([
      1, 2, 3,
    ]);
  });
});

describe("language model providers", () => {
  it("are chosen in the environment", () => {
    setLlmProvider(undefined);
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash");
    expect(createLlmProvider()?.name).toBe("gemini:gemini-flash");

    vi.stubEnv("AI_PROVIDER", "ollama");
    vi.stubEnv("OLLAMA_MODEL", "qwen3");
    expect(createLlmProvider()?.name).toBe("ollama:qwen3");

    vi.stubEnv("AI_PROVIDER", "");
    expect(createLlmProvider()).toBeNull();
  });

  it("send Gemini the system text apart and ask for JSON when needed", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"terms":[]}' }] } }],
        }),
        { status: 200 },
      ),
    );
    const gemini = new GeminiProvider({
      apiKey: "key",
      model: "m",
      timeoutMs: 1000,
      thinkingLevel: null,
    });

    const answer = await gemini.chat({
      messages: [
        { role: "system", content: "Regler" },
        { role: "user", content: "Spørsmål" },
      ],
      json: true,
    });

    expect(answer).toBe('{"terms":[]}');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/models/m:generateContent");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.systemInstruction.parts[0].text).toBe("Regler");
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Spørsmål" }] },
    ]);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    // No level set: the model's own default
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it("ask Gemini for the thinking level set, and leave thoughts out of the answer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: "Tenker på fristene", thought: true },
                  { text: "Neste frist er 10. desember [1]." },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    setLlmProvider(undefined);
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "key");
    vi.stubEnv("GEMINI_MODEL", "gemini-4-hydrogen");
    vi.stubEnv("GEMINI_THINKING_LEVEL", " Low ");
    const gemini = createLlmProvider();

    const answer = await gemini?.chat({
      messages: [{ role: "user", content: "Neste frist?" }],
    });

    expect(answer).toBe("Neste frist er 10. desember [1].");
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.generationConfig.thinkingConfig).toEqual({
      thinkingLevel: "low",
    });
  });

  it("turn Gemini's errors into the app's own", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "quota" } }), {
        status: 429,
      }),
    );
    const gemini = new GeminiProvider({
      apiKey: "key",
      model: "m",
      timeoutMs: 1000,
      thinkingLevel: null,
    });

    await expect(gemini.chat({ messages: [] })).rejects.toBeInstanceOf(
      LlmResponseError,
    );

    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );
    await expect(gemini.chat({ messages: [] })).rejects.toBeInstanceOf(
      LlmUnavailableError,
    );

    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(timeout);
    await expect(gemini.chat({ messages: [] })).rejects.toBeInstanceOf(
      LlmTimeoutError,
    );
  });

  it("try Gemini again when it is busy, but not when the quota is used up", async () => {
    const busy = () =>
      new Response(JSON.stringify({ error: { message: "high demand" } }), {
        status: 503,
      });
    const answer = () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Svar [1]." }] } }],
        }),
        { status: 200 },
      );
    const gemini = new GeminiProvider({
      apiKey: "key",
      model: "m",
      timeoutMs: 1000,
      thinkingLevel: null,
      retryDelaysMs: [1, 1],
    });

    // Busy, then a connection lost for a moment, then an answer
    let fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(busy())
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(answer());
    await expect(gemini.chat({ messages: [] })).resolves.toBe("Svar [1].");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Busy every time: three tries, then the error
    fetchMock.mockReset();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => busy());
    await expect(gemini.chat({ messages: [] })).rejects.toThrow(
      "Gemini answered 503",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // A used-up quota is an error of its own
    fetchMock.mockReset();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(gemini.chat({ messages: [] })).rejects.toBeInstanceOf(
      LlmQuotaError,
    );

    // The quota and a bad request do not pass by themselves: one try
    for (const status of [429, 400]) {
      fetchMock.mockReset();
      fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("{}", { status }));
      await expect(gemini.chat({ messages: [] })).rejects.toBeInstanceOf(
        LlmResponseError,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("give Gemini no more time than the request has left", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 503 }));
    const gemini = new GeminiProvider({
      apiKey: "key",
      model: "m",
      timeoutMs: 60_000,
      thinkingLevel: null,
      retryDelaysMs: [5000],
    });

    // 60 seconds would leave time for a try after 5; 2 seconds do not
    await expect(
      gemini.chat({ messages: [], timeoutMs: 2000 }),
    ).rejects.toBeInstanceOf(LlmResponseError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("do not try Gemini again when there is no time left for it", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 503 }));
    const gemini = new GeminiProvider({
      apiKey: "key",
      model: "m",
      timeoutMs: 1000,
      thinkingLevel: null,
      retryDelaysMs: [5000],
    });

    await expect(gemini.chat({ messages: [] })).rejects.toBeInstanceOf(
      LlmResponseError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("send Ollama the messages and the JSON format", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message: { role: "assistant", content: "Svar" },
          done: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const ollama = new OllamaProvider({
      host: "http://localhost:11434",
      model: "qwen3",
      apiKey: null,
      timeoutMs: 1000,
    });

    const answer = await ollama.chat({
      messages: [{ role: "user", content: "Hei" }],
      json: true,
    });

    expect(answer).toBe("Svar");
    const init = fetchMock.mock.calls[0]?.[1] ?? {};
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "qwen3",
      format: "json",
      stream: false,
      think: false,
      // The default context window would cut the sources off
      options: { num_ctx: 8192 },
    });
  });

  it("tell when Ollama Cloud's limits are used up", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "usage limit reached" }), {
        status: 429,
      }),
    );
    const ollama = new OllamaProvider({
      host: "https://ollama.com",
      model: "gpt-oss:20b",
      apiKey: "key",
      timeoutMs: 1000,
    });

    await expect(ollama.chat({ messages: [] })).rejects.toBeInstanceOf(
      LlmQuotaError,
    );
  });

  it("say when Ollama is not running", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );
    const ollama = new OllamaProvider({
      host: "http://localhost:11434",
      model: "qwen3",
      apiKey: null,
      timeoutMs: 1000,
    });

    await expect(ollama.chat({ messages: [] })).rejects.toThrow(
      "Is it running?",
    );
  });
});
