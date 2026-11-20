import "server-only";
import { cache } from "react";
import { apiFetch } from "./api";
import type {
  Assessment,
  AssessmentQuestionsResponse,
  Company,
  QuestionsResponse,
} from "./types";

// The API calls the pages make. cache() makes each one once per request,
// so a page and its title (generateMetadata) share the answer.

export const getCompany = cache((orgNumber: string) =>
  apiFetch<Company>(`/api/companies/${orgNumber}`),
);

export const getCompanyQuestions = cache((orgNumber: string) =>
  apiFetch<QuestionsResponse>(`/api/companies/${orgNumber}/questions`),
);

export const getAssessment = cache((id: string) =>
  apiFetch<Assessment>(`/api/assessments/${encodeURIComponent(id)}`),
);

export const getAssessmentQuestions = cache((id: string) =>
  apiFetch<AssessmentQuestionsResponse>(
    `/api/assessments/${encodeURIComponent(id)}/questions`,
  ),
);
