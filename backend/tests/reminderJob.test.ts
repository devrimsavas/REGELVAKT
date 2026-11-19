import { afterEach, describe, expect, it, vi } from "vitest";

// The job is tested without the reminder work itself: runReminders is
// replaced by one that finishes when the test says so
let finishRun = () => {};
const runReminders = vi.fn(
  () =>
    new Promise((resolve) => {
      finishRun = () => resolve({});
    }),
);
vi.mock("../src/services/reminderService.js", () => ({ runReminders }));

const { resetReminderJob, startReminderJob, stopReminderJob } = await import(
  "../src/jobs/reminderJob.js"
);

afterEach(async () => {
  finishRun();
  await stopReminderJob();
  resetReminderJob();
  vi.unstubAllEnvs();
  runReminders.mockClear();
});

describe("the reminder job", () => {
  it("runs at once when the hour has come", () => {
    vi.stubEnv("EMAIL_HOUR", "0");

    startReminderJob();

    expect(runReminders).toHaveBeenCalledTimes(1);
  });

  it("waits for a run that is going on before it stops", async () => {
    vi.stubEnv("EMAIL_HOUR", "0");
    startReminderJob();

    let stopped = false;
    const stopping = stopReminderJob().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);

    finishRun();
    await stopping;
    expect(stopped).toBe(true);
  });

  it("stops at once when nothing is running", async () => {
    vi.stubEnv("EMAIL_HOUR", "23");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T05:00:00Z"));

    startReminderJob();
    await stopReminderJob();

    expect(runReminders).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
