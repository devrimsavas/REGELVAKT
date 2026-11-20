import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { sequelize } from "../src/config/database.js";
import { useLogs } from "./helpers/logs.js";

const logs = useLogs();

describe("GET /api", () => {
  it("responds with the main API message", async () => {
    const response = await request(app).get("/api");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message");
  });
});

describe("GET /api/health", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says ok when the database answers", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    // Docker asks every 30 seconds; no request line for each
    expect(logs.raw.join("")).not.toContain("GET /api/health");
  });

  it("answers 503 when the database is down", async () => {
    vi.spyOn(sequelize, "query").mockRejectedValueOnce(
      new Error("connect ECONNREFUSED"),
    );

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
    expect(logs.raw.join("")).toContain("the database is down");
  });
});
