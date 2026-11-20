import type { Request, Response } from "express";
import { lastCrawl } from "../knowledge/crawler.js";
import { Assessment } from "../models/Assessment.js";
import { KnowledgeChunk } from "../models/KnowledgeChunk.js";
import { KnowledgePage } from "../models/KnowledgePage.js";
import { EMAIL_LANGUAGES, type EmailLanguage } from "../models/Subscription.js";
import { markUsed } from "../services/assessmentService.js";
import {
  askCached,
  type CompanyContext,
  companyContext,
  DailyLimitError,
} from "../services/assistantService.js";
import { createLlmProvider } from "../services/llm/llmProvider.js";
import {
  companyRulesSource,
  generalRulesSource,
  type RulesSource,
} from "../services/rulesSource.js";
import { todayInNorway } from "../utils/today.js";
import { isUuid } from "../utils/uuid.js";

const MIN_QUESTION = 3;
const MAX_QUESTION = 500;

// POST /api/assistant/ask
export const askAssistant = async (req: Request, res: Response) => {
  // #swagger.tags = ["Assistant"]
  // #swagger.summary = "Ask a question about obligations; answered from official pages with numbered sources"
  /* #swagger.description = "language is nb (default) or en. Source 1 (kind 'rules') is Regelvakt's own rules: with assessmentId, the obligations and next deadlines of that company, and the sources that fit it rank higher; without, every obligation with who it applies to and its deadlines. The other sources (kind 'page') are sections of official pages. mode is 'answer' when a language model wrote the answer, 'sources' when only the most relevant official sections are given (no model set up, or it could not answer). The question is not stored. Do not write personal details in it: it is sent to the language model." */
  /* #swagger.requestBody = {
       required: true,
       content: {
         "application/json": {
           example: { question: "Når må jeg levere mva-meldingen?", language: "nb" }
         }
       }
     } */
  const body: Record<string, unknown> =
    typeof req.body === "object" && req.body !== null ? req.body : {};
  const errors: string[] = [];

  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < MIN_QUESTION || question.length > MAX_QUESTION) {
    errors.push(
      `question must be between ${MIN_QUESTION} and ${MAX_QUESTION} characters`,
    );
  }

  const language = body.language ?? "nb";
  if (!(EMAIL_LANGUAGES as readonly unknown[]).includes(language)) {
    errors.push(`language must be one of: ${EMAIL_LANGUAGES.join(", ")}`);
  }

  const assessmentId = body.assessmentId;
  if (assessmentId !== undefined && !isUuid(assessmentId)) {
    errors.push("assessmentId must be an assessment id");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: "Invalid question", details: errors });
    return;
  }

  const today = todayInNorway();
  let context: CompanyContext | null = null;
  let rules: RulesSource = generalRulesSource(language as EmailLanguage);
  if (isUuid(assessmentId)) {
    const assessment = await Assessment.findByPk(assessmentId);
    if (!assessment) {
      res.status(404).json({ error: "Assessment not found" });
      return;
    }
    await markUsed(assessment);
    context = companyContext(assessment.companySnapshot);
    rules = companyRulesSource(assessment, today, language as EmailLanguage);
  }

  if ((await KnowledgePage.count()) === 0) {
    res.status(503).json({
      error:
        "The assistant's knowledge base is not ready yet. Try again later.",
    });
    return;
  }

  try {
    res.json(
      await askCached(
        { question, language: language as EmailLanguage, context, rules },
        today.toISOString().slice(0, 10),
      ),
    );
  } catch (error: unknown) {
    if (error instanceof DailyLimitError) {
      res.status(429).json({
        error:
          "The assistant has answered as many questions as it can today. Try again tomorrow.",
      });
      return;
    }
    throw error;
  }
};

// GET /api/assistant/status
export const getAssistantStatus = async (_req: Request, res: Response) => {
  // #swagger.tags = ["Assistant"]
  // #swagger.summary = "Whether the assistant is ready: the knowledge base and the language model"
  const [pages, sections, updatedAt] = await Promise.all([
    KnowledgePage.count(),
    KnowledgeChunk.count(),
    lastCrawl(),
  ]);
  const provider = createLlmProvider();
  res.json({
    ready: pages > 0,
    knowledgeBase: { pages, sections, updatedAt },
    // null: no language model; the assistant gives the sources only
    model: provider?.name ?? null,
  });
};
