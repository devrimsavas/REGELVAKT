import express from "express";
import {
  confirmSubscription,
  lookupSubscription,
  unsubscribeSubscription,
  updateSubscription,
} from "../controllers/subscriptionController.js";

const router = express.Router();

// No login: the token from the email says which subscription it is. The
// tokens go in the body, not the URL, so they stay out of logs.
router.post("/confirm", confirmSubscription);
router.post("/lookup", lookupSubscription);
router.patch("/", updateSubscription);
router.post("/unsubscribe", unsubscribeSubscription);

export default router;
