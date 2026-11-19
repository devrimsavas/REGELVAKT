import type { Request, Response } from "express";
import { Assessment } from "../models/Assessment.js";
import type { Subscription } from "../models/Subscription.js";
import { EmailError } from "../services/email/emailSender.js";
import {
  confirm,
  findByManageToken,
  InvalidTokenError,
  parseSettings,
  parseSubscriptionInput,
  SubscriptionNotFoundError,
  subscribe,
  toSubscriptionView,
  unsubscribe,
  updateSettings,
} from "../services/subscriptionService.js";
import { manageToken } from "../utils/tokens.js";
import { isUuid } from "../utils/uuid.js";

function tokenOf(body: unknown): unknown {
  return typeof body === "object" && body !== null && "token" in body
    ? body.token
    : undefined;
}

// The subscription with its assessment, as the manage page shows it
async function view(subscription: Subscription) {
  const assessment = await Assessment.findByPk(subscription.assessmentId, {
    rejectOnEmpty: true,
  });
  return toSubscriptionView(subscription, assessment);
}

// Answers the errors the subscription service throws on purpose
function answerKnownError(error: unknown, res: Response): boolean {
  if (error instanceof InvalidTokenError) {
    res.status(400).json({ error: error.message });
    return true;
  }
  if (error instanceof SubscriptionNotFoundError) {
    res.status(404).json({ error: error.message });
    return true;
  }
  return false;
}

// POST /api/assessments/:id/subscriptions
export const createSubscription = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  // #swagger.tags = ["Reminders"]
  // #swagger.summary = "Ask for email reminders about an assessment's deadlines"
  /* #swagger.description = "Sends a confirmation email; reminders start when its link is used. The answer is the same whether or not the address already gets reminders. language (nb or en) and reminderDays (from 1, 3, 7, 14, 30) may be left out: nb and [14, 3]." */
  /* #swagger.requestBody = {
       required: true,
       content: {
         "application/json": {
           example: { email: "ayse@example.com", language: "nb", reminderDays: [14, 3], consent: true }
         }
       }
     } */
  const { id } = req.params;

  if (!isUuid(id)) {
    res.status(400).json({ error: "Invalid assessment id" });
    return;
  }

  const parsed = parseSubscriptionInput(req.body);
  if (!parsed.ok) {
    res
      .status(400)
      .json({ error: "Invalid subscription", details: parsed.errors });
    return;
  }

  const assessment = await Assessment.findByPk(id);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  // The trustee in bankruptcy has taken over the obligations, so reminders
  // to the owner would be wrong
  if (assessment.companySnapshot.isBankrupt) {
    res.status(422).json({
      error: "Reminders are not available for a bankrupt company",
    });
    return;
  }

  try {
    await subscribe(assessment, parsed.value);
  } catch (error: unknown) {
    if (error instanceof EmailError) {
      req.log.error({ err: error }, "Could not send the email");
      res
        .status(502)
        .json({ error: "Could not send the email. Try again later." });
      return;
    }
    throw error;
  }

  res.status(202).json({
    message:
      "If the address can get reminders, a confirmation email is on its way",
  });
};

// POST /api/subscriptions/confirm
export const confirmSubscription = async (req: Request, res: Response) => {
  // #swagger.tags = ["Reminders"]
  // #swagger.summary = "Confirm a subscription with the token from the confirmation email"
  /* #swagger.description = "Answers with the subscription and its manageToken, for the web app's manage page." */
  /* #swagger.requestBody = {
       required: true,
       content: { "application/json": { example: { token: "token from the link in the confirmation email" } } }
     } */
  try {
    const subscription = await confirm(tokenOf(req.body));
    res.json({
      ...(await view(subscription)),
      manageToken: manageToken(subscription.id),
    });
  } catch (error: unknown) {
    if (!answerKnownError(error, res)) throw error;
  }
};

// POST /api/subscriptions/lookup
export const lookupSubscription = async (req: Request, res: Response) => {
  // #swagger.tags = ["Reminders"]
  // #swagger.summary = "Read a subscription with the manage token from an email"
  /* #swagger.requestBody = {
       required: true,
       content: { "application/json": { example: { token: "manageToken" } } }
     } */
  try {
    const subscription = await findByManageToken(tokenOf(req.body));
    res.json(await view(subscription));
  } catch (error: unknown) {
    if (!answerKnownError(error, res)) throw error;
  }
};

// PATCH /api/subscriptions
export const updateSubscription = async (req: Request, res: Response) => {
  // #swagger.tags = ["Reminders"]
  // #swagger.summary = "Change the language or the reminder days"
  /* #swagger.requestBody = {
       required: true,
       content: { "application/json": { example: { token: "manageToken", reminderDays: [7, 1] } } }
     } */
  const parsed = parseSettings(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: "Invalid settings", details: parsed.errors });
    return;
  }

  try {
    const subscription = await updateSettings(tokenOf(req.body), parsed.value);
    res.json(await view(subscription));
  } catch (error: unknown) {
    if (!answerKnownError(error, res)) throw error;
  }
};

// POST /api/subscriptions/unsubscribe
export const unsubscribeSubscription = async (req: Request, res: Response) => {
  // #swagger.tags = ["Reminders"]
  // #swagger.summary = "Stop the reminders and delete the email address"
  /* #swagger.requestBody = {
       required: true,
       content: { "application/json": { example: { token: "manageToken" } } }
     } */
  try {
    await unsubscribe(tokenOf(req.body));
    res.json({ unsubscribed: true });
  } catch (error: unknown) {
    if (!answerKnownError(error, res)) throw error;
  }
};
