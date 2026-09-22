import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../index.js";
import { seedDatabase } from "../scripts/seed.js";
import { _resetForTests } from "../realtime/broadcaster.js";

let mongod;
let authCookie;
let server;
let port;

function extractAuthCookie(res) {
  const header = res.headers["set-cookie"];
  if (!header) return null;
  const cookies = Array.isArray(header) ? header : [header];
  return cookies.find((c) => c.startsWith("auth=")) ?? null;
}

function openStream(cookie) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/events",
        headers: cookie ? { Cookie: cookie } : {},
      },
      (res) => resolve({ req, res })
    );
    req.on("error", reject);
  });
}

function readChunks(res, count, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => {
      res.removeAllListeners("data");
      reject(new Error(`timed out waiting for ${count} SSE chunks, got: ${buf}`));
    }, timeoutMs);
    res.on("data", (chunk) => {
      buf += chunk.toString();
      const frames = buf.split("\n\n").filter((f) => f.trim().length > 0);
      if (frames.length >= count) {
        clearTimeout(timer);
        res.removeAllListeners("data");
        resolve(buf);
      }
    });
    res.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function parseDataFrames(buf) {
  return buf
    .split("\n\n")
    .filter((f) => f.includes("data:"))
    .map((f) => {
      const line = f.split("\n").find((l) => l.startsWith("data:"));
      try {
        return JSON.parse(line.slice("data:".length).trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedDatabase();

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@crm.local", password: "admin1234" });
  assert.equal(loginRes.status, 200);
  authCookie = extractAuthCookie(loginRes);
  assert.ok(authCookie);

  server = app.listen(0);
  await new Promise((r) => server.on("listening", r));
  port = server.address().port;
});

after(async () => {
  _resetForTests();
  await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  await mongod.stop();
});

describe("GET /api/events", () => {
  it("returns 401 without a cookie", async (t) => {
    const { req, res } = await openStream(null);
    t.after(() => req.destroy());
    assert.equal(res.statusCode, 401);
    req.destroy();
  });

  it("opens a stream with SSE headers and initial comment", async (t) => {
    const { req, res } = await openStream(authCookie);
    t.after(() => {
      req.destroy();
      _resetForTests();
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /text\/event-stream/);
    assert.equal(res.headers["x-accel-buffering"], "no");
    const buf = await readChunks(res, 1);
    assert.ok(buf.includes(": connected"));
  });

  it("emits lead.created with full lead before activity.created on POST /api/leads", async (t) => {
    const { req, res } = await openStream(authCookie);
    t.after(() => {
      req.destroy();
      _resetForTests();
    });
    await readChunks(res, 1);
    const dataPromise = readChunks(res, 2, 8000);

    const createRes = await request(app)
      .post("/api/leads")
      .set("Cookie", authCookie)
      .send({ name: "SSE Lead", email: "sse.lead@example.co.za", source: "referral" });
    assert.equal(createRes.status, 201);

    const buf = await dataPromise;
    const events = parseDataFrames(buf);
    assert.equal(events[0].type, "lead.created");
    assert.ok(events[0].payload.lead.id);
    assert.equal(events[0].payload.lead.name, "SSE Lead");
    assert.equal(events[0].payload.lead.email, "sse.lead@example.co.za");
    assert.ok(events[0].at);
    assert.equal(events[1].type, "activity.created");
    assert.equal(events[1].payload.leadId, events[0].payload.lead.id);
  });

  it("emits lead.updated then activity.created on PATCH", async (t) => {

    const created = await request(app)
      .post("/api/leads")
      .set("Cookie", authCookie)
      .send({ name: "SSE Patch", email: "sse.patch@example.co.za", source: "other" });
    assert.equal(created.status, 201);

    const { req, res } = await openStream(authCookie);
    t.after(() => {
      req.destroy();
      _resetForTests();
    });
    await readChunks(res, 1); // ": connected"
    const patchPromise = readChunks(res, 2, 8000);

    const patchRes = await request(app)
      .patch(`/api/leads/${created.body.id}`)
      .set("Cookie", authCookie)
      .send({ status: "contacted" });
    assert.equal(patchRes.status, 200);

    const buf = await patchPromise;
    const events = parseDataFrames(buf);
    assert.equal(events[0].type, "lead.updated");
    assert.equal(events[0].payload.lead.id, created.body.id);
    assert.equal(events[0].payload.lead.status, "contacted");
    assert.equal(events[1].type, "activity.created");
  });

  it("emits lead.deleted with leadId on DELETE", async (t) => {
    const created = await request(app)
      .post("/api/leads")
      .set("Cookie", authCookie)
      .send({ name: "SSE Delete", email: "sse.delete@example.co.za", source: "other" });

    const { req, res } = await openStream(authCookie);
    t.after(() => {
      req.destroy();
      _resetForTests();
    });
    await readChunks(res, 1);
    const dataPromise = readChunks(res, 1, 8000);

    const delRes = await request(app)
      .delete(`/api/leads/${created.body.id}`)
      .set("Cookie", authCookie);
    assert.equal(delRes.status, 204);

    const buf = await dataPromise;
    const events = parseDataFrames(buf);
    assert.equal(events[0].type, "lead.deleted");
    assert.equal(events[0].payload.leadId, created.body.id);
  });

  it("emits only activity.created (no lead.updated) on POST note", async (t) => {
    const created = await request(app)
      .post("/api/leads")
      .set("Cookie", authCookie)
      .send({ name: "SSE Note", email: "sse.note@example.co.za", source: "other" });

    const { req, res } = await openStream(authCookie);
    t.after(() => {
      req.destroy();
      _resetForTests();
    });
    await readChunks(res, 1);
    const dataPromise = readChunks(res, 1, 8000);

    const noteRes = await request(app)
      .post(`/api/leads/${created.body.id}/notes`)
      .set("Cookie", authCookie)
      .send({ body: "hello via SSE" });
    assert.equal(noteRes.status, 201);

    const buf = await dataPromise;
    const events = parseDataFrames(buf);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "activity.created");
    assert.equal(events[0].payload.leadId, created.body.id);
  });

  it("emits lead.created on POST /api/capture", async (t) => {
    const { req, res } = await openStream(authCookie);
    t.after(() => {
      req.destroy();
      _resetForTests();
    });
    await readChunks(res, 1);
    const dataPromise = readChunks(res, 1, 8000);

    const capRes = await request(app).post("/api/capture").send({
      name: "SSE Capture",
      email: "sse.capture@example.co.za",
      source: "contact-form",
      message: "hi",
    });
    assert.equal(capRes.status, 200);

    const buf = await dataPromise;
    const events = parseDataFrames(buf);
    assert.equal(events[0].type, "lead.created");
    assert.equal(events[0].payload.lead.name, "SSE Capture");
  });

  it("returns 429 on the 6th concurrent connection, 401 beats 429 for unauth", async (t) => {
    const streams = [];
    t.after(() => {
      for (const s of streams) s.req.destroy();
      _resetForTests();
    });
    for (let i = 0; i < 5; i++) {
      const s = await openStream(authCookie);
      streams.push(s);
      await readChunks(s.res, 1);
    }
    const sixth = await request(app).get("/api/events").set("Cookie", authCookie);
    assert.equal(sixth.status, 429);
    assert.equal(sixth.body.error.code, "RATE_LIMITED");
    assert.equal(sixth.body.error.message, "Too many requests, please try again later");

    const unauth = await request(app).get("/api/events");
    assert.equal(unauth.status, 401);
  });
});
