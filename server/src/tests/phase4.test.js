import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../index.js";
import { Lead, Note, Activity } from "../models/index.js";

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("POST /api/capture (Public Lead Capture)", () => {
  it("returns 400 VALIDATION_ERROR when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/capture")
      .send({ email: "public@example.co.za", source: "contact-form" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields.name);
    assert.ok(res.body.error.fields.message);
  });

  it("returns 400 VALIDATION_ERROR when email is malformed", async () => {
    const res = await request(app)
      .post("/api/capture")
      .send({
        name: "Public Visitor",
        email: "bad-email",
        source: "contact-form",
        message: "Hello world",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields.email);
  });

  it("accepts and strips unknown fields (e.g. csrf_token, utm_source) without error", async () => {
    const res = await request(app)
      .post("/api/capture")
      .send({
        name: "Public Visitor",
        email: "extra-fields@example.co.za",
        source: "contact-form",
        message: "Hello world",
        csrf_token: "token-12345",
        utm_source: "google-ads",
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const lead = await Lead.findOne({ email: "extra-fields@example.co.za" });
    assert.ok(lead);
    assert.equal(lead.name, "Public Visitor");
  });

  it("successfully captures a lead, note, and activities for valid submissions", async () => {
    const payload = {
      name: "Public Lead",
      email: "public.lead@example.co.za",
      phone: "0829990000",
      company: "Public Co",
      source: "contact-form",
      message: "Interested in consulting services",
    };

    const res = await request(app)
      .post("/api/capture")
      .send(payload);

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.message);

    const lead = await Lead.findOne({ email: payload.email });
    assert.ok(lead);
    assert.equal(lead.name, payload.name);
    assert.equal(lead.status, "new");

    const note = await Note.findOne({ leadId: lead._id });
    assert.ok(note);
    assert.equal(note.source, "capture");
    assert.equal(note.authorId, null);
    assert.equal(note.body, payload.message);

    const leadActivity = await Activity.findOne({ leadId: lead._id, type: "lead_created" });
    assert.ok(leadActivity);
    assert.equal(leadActivity.actorId, null);

    const noteActivity = await Activity.findOne({ leadId: lead._id, type: "note_added" });
    assert.ok(noteActivity);
    assert.equal(noteActivity.actorId, null);
  });

  it("triggers honeypot and returns opaque 200 OK without creating DB records when botField is filled", async () => {
    const botPayload = {
      name: "Spam Bot",
      email: "spambot@example.com",
      source: "other",
      message: "Buy cheap watches",
      botField: "iamabot",
    };

    const res = await request(app)
      .post("/api/capture")
      .send(botPayload);

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.message);

    const lead = await Lead.findOne({ email: botPayload.email });
    assert.equal(lead, null);

    const notes = await Note.find({ body: botPayload.message });
    assert.equal(notes.length, 0);
  });

  it("allows duplicate emails on public capture without 409 error", async () => {
    const payload = {
      name: "Repeat Enquiry",
      email: "public.lead@example.co.za",
      source: "contact-form",
      message: "Second enquiry for another project",
    };

    const res = await request(app)
      .post("/api/capture")
      .send(payload);

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const leads = await Lead.find({ email: payload.email });
    assert.equal(leads.length, 2);
  });

  // Note: this test temporarily enables the limiter via TEST_RATE_LIMIT
  // so that a request-counting store is populated only for the duration
  // of this block. The store is not reset afterward — any test added
  // below that also enables the limiter will start from count=6.
  it("enforces rate limit of 5 requests per hour and returns 429 RATE_LIMITED on the sixth submission", async () => {
    process.env.TEST_RATE_LIMIT = "true";

    try {
      const payload = {
        name: "Rate Limit Test",
        source: "contact-form",
        message: "Testing rate limit",
      };

      let lastRes;
      for (let i = 0; i < 6; i++) {
        lastRes = await request(app)
          .post("/api/capture")
          .send({ ...payload, email: `ratelimit-${i}@example.co.za` });
      }

      assert.equal(lastRes.status, 429);
      assert.equal(lastRes.body.error.code, "RATE_LIMITED");
      assert.equal(lastRes.body.error.message, "Too many requests, please try again later");
    } finally {
      delete process.env.TEST_RATE_LIMIT;
    }
  });

  it("returns a byte-identical response whether a lead was created or the honeypot fired", async () => {
    const created = await request(app).post("/api/capture").send({
      name: "Uniform A",
      email: "uniform-a@example.co.za",
      source: "contact-form",
      message: "Test A",
    });

    const honeypot = await request(app).post("/api/capture").send({
      name: "Uniform B",
      email: "uniform-b@example.co.za",
      source: "contact-form",
      message: "Test B",
      botField: "triggered",
    });

    assert.equal(created.status, honeypot.status);
    assert.equal(JSON.stringify(created.body), JSON.stringify(honeypot.body));
  });

  it("does not return the created lead id in the response", async () => {
    const res = await request(app).post("/api/capture").send({
      name: "Privacy Check",
      email: "privacy-check@example.co.za",
      source: "contact-form",
      message: "Check",
    });

    const lead = await Lead.findOne({ email: "privacy-check@example.co.za" });
    assert.ok(lead);

    const body = JSON.stringify(res.body);
    assert.ok(!body.includes(lead._id.toString()), "Response must not contain the lead id");
    assert.ok(!body.includes("id"), "Response must not contain any identifier field");
  });

  it("does not disclose whether the submitted email already exists", async () => {
    const existing = await request(app).post("/api/capture").send({
      name: "Existing Email",
      email: "public.lead@example.co.za",
      source: "contact-form",
      message: "Second enquiry",
    });

    const novel = await request(app).post("/api/capture").send({
      name: "Novel Email",
      email: "brand-new-address@example.co.za",
      source: "contact-form",
      message: "First enquiry",
    });

    assert.equal(existing.status, novel.status);
    assert.equal(JSON.stringify(existing.body), JSON.stringify(novel.body));
  });

  it("treats a whitespace-only botField as not-bot and creates the lead", async () => {
    const res = await request(app).post("/api/capture").send({
      name: "Whitespace Test",
      email: "whitespace-botfield@example.co.za",
      source: "contact-form",
      message: "Not a bot",
      botField: "   ",
    });

    assert.equal(res.status, 200);

    const lead = await Lead.findOne({ email: "whitespace-botfield@example.co.za" });
    assert.ok(lead, "Lead should be created when botField is only whitespace");
  });
});
