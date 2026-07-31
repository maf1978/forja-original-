import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { hqApp } from "../src/hq";
import type { Env } from "../src/env";

const password = "control-password";
const header = { Authorization: `Basic ${Buffer.from(`admin:${password}`).toString("base64")}` };

function env(): Env {
  const stmt: any = { bind: () => stmt, all: async () => ({ results: [] }), run: async () => ({}) };
  return {
    DB: { prepare: () => stmt } as unknown as D1Database,
    DASHBOARD_PASSWORD: "realtor-password",
    DASHBOARD_PASSWORD_Control_Center: password,
    DASHBOARD_BASE_URL: "https://suite.test",
    BOT_NAME: "Jorge AI Concierge",
    BUSINESS_NAME: "Jorge Realty",
  } as Env;
}

describe("Hawk Guru Control Center route", () => {
  it("renders /hq/ after a valid dedicated login", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/hq", hqApp);
    const res = await app.fetch(new Request("https://suite.test/hq", { headers: header }), env());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("HAWK GURU · CONTROL CENTER");
  });
});
