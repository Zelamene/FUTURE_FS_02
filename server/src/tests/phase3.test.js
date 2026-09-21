import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../index.js";
import { seedDatabase } from "../scripts/seed.js";
import { Lead, Note, Activity } from "../models/index.js";

let mongod;
let authCookie;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedDatabase();

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@crm.local", password: "admin1234" });

  const header = loginRes.headers["set-cookie"];
  const cookies = Array.isArray(header) ? header : [header];
  authCookie = cookies.find((c) => c.startsWith("auth="));
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("GET /api/leads", () => {
  it("returns 401 UNAUTHORIZED when no auth cookie is provided", async () => {
    const res = await request(app).get("/api/leads");
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  it("returns 200 OK with paginated list of leads when authenticated", async () => {
    const res = await request(app)
      .get("/api/leads")
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.total, 12);
    assert.equal(res.body.limit, 50);
    assert.equal(res.body.offset, 0);

    const first = res.body.data[0];
    assert.ok(first.id);
    assert.equal(first._id, undefined);
    assert.equal(first.__v, undefined);
  });

  it("filters leads by status", async () => {
    const res = await request(app)
      .get("/api/leads?status=contacted")
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.every((lead) => lead.status === "contacted"));
  });

  it("filters leads by source", async () => {
    const res = await request(app)
      .get("/api/leads?source=whatsapp")
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.every((lead) => lead.source === "whatsapp"));
  });

  it("searches leads by name or email or company with regex escaping", async () => {
    const res = await request(app)
      .get("/api/leads?search=Thandi")
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].name, "Thandi Mokoena");

    // Special regex characters should be escaped safely, not throw SyntaxError or leak all leads
    const regexTestRes = await request(app)
      .get("/api/leads?search=(")
      .set("Cookie", authCookie);
    assert.equal(regexTestRes.status, 200);
    assert.equal(regexTestRes.body.data.length, 0);
  });

  it("supports limit and offset pagination", async () => {
    const res = await request(app)
      .get("/api/leads?limit=5&offset=2")
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 5);
    assert.equal(res.body.limit, 5);
    assert.equal(res.body.offset, 2);
    assert.equal(res.body.total, 12);
  });

  it("sorts leads by name_asc", async () => {
    const res = await request(app)
      .get("/api/leads?sort=name_asc&limit=3")
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    const names = res.body.data.map((l) => l.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sortedNames);
  });

  it("sorts leads by followUpDate_asc with nulls last", async () => {
    const res = await request(app)
      .get("/api/leads?sort=followUpDate_asc&limit=12")
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    const leads = res.body.data;
    const leadsWithFollowUp = leads.filter((l) => l.followUpDate !== null);
    const leadsWithoutFollowUp = leads.filter((l) => l.followUpDate === null);

    assert.ok(leadsWithFollowUp.length > 0);
    assert.ok(leadsWithoutFollowUp.length > 0);
    assert.equal(leads.indexOf(leadsWithFollowUp[0]), 0);
    assert.equal(leads.indexOf(leadsWithoutFollowUp[0]), leadsWithFollowUp.length);
  });
});

describe("POST /api/leads", () => {
  it("returns 400 VALIDATION_ERROR when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/leads")
      .set("Cookie", authCookie)
      .send({ email: "test@example.co.za" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields.name);
    assert.ok(res.body.error.fields.source);
  });

  it("returns 400 VALIDATION_ERROR when email is malformed", async () => {
    const res = await request(app)
      .post("/api/leads")
      .set("Cookie", authCookie)
      .send({ name: "Invalid Email Lead", email: "not-an-email", source: "other" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields.email);
  });

  it("creates a new lead and logs lead_created activity", async () => {
    const payload = {
      name: "Sipho Khumalo",
      email: "sipho.k@example.co.za",
      phone: "0819998877",
      company: "Khumalo Holdings",
      source: "contact-form",
      status: "new",
    };

    const res = await request(app)
      .post("/api/leads")
      .set("Cookie", authCookie)
      .send(payload);

    assert.equal(res.status, 201);
    assert.equal(res.body.name, payload.name);
    assert.equal(res.body.email, payload.email);
    assert.ok(res.body.id);

    const activity = await Activity.findOne({ leadId: res.body.id, type: "lead_created" });
    assert.ok(activity);
    assert.equal(activity.meta?.source, "contact-form");
  });

  it("allows duplicate email addresses without returning 409", async () => {
    const payload = {
      name: "Duplicate Email Test",
      email: "thandi@example.co.za",
      source: "referral",
    };

    const res = await request(app)
      .post("/api/leads")
      .set("Cookie", authCookie)
      .send(payload);

    assert.equal(res.status, 201);
    assert.equal(res.body.email, "thandi@example.co.za");
  });
});

describe("GET /api/leads/:id", () => {
  it("returns 404 NOT_FOUND for an invalid or 12-char ObjectId string", async () => {
    const res = await request(app)
      .get("/api/leads/helloWorldxx")
      .set("Cookie", authCookie);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  it("returns 404 NOT_FOUND for a non-existent ObjectId", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/leads/${nonExistentId}`)
      .set("Cookie", authCookie);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  it("returns 200 OK with lead details, notes, and activity", async () => {
    const thandi = await Lead.findOne({ name: "Thandi Mokoena" });
    assert.ok(thandi);

    const res = await request(app)
      .get(`/api/leads/${thandi._id}`)
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, thandi._id.toString());
    assert.equal(res.body.name, "Thandi Mokoena");
    assert.ok(Array.isArray(res.body.notes));
    assert.ok(Array.isArray(res.body.activity));
    assert.equal(res.body.notes.length, 2);
  });
});

describe("PATCH /api/leads/:id", () => {
  it("returns 404 NOT_FOUND for a non-existent lead", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/api/leads/${nonExistentId}`)
      .set("Cookie", authCookie)
      .send({ name: "Updated Name" });

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  it("automatically sets lastContactedAt per FR-LEAD-8 when status transitions to contacted", async () => {
    const lead = await Lead.create({
      name: "FR-LEAD-8 Test Lead",
      email: "frlead8@example.co.za",
      source: "referral",
      status: "new",
      lastContactedAt: null,
    });

    const res = await request(app)
      .patch(`/api/leads/${lead._id}`)
      .set("Cookie", authCookie)
      .send({ status: "contacted" });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "contacted");
    assert.ok(res.body.lastContactedAt, "lastContactedAt should be set automatically");
  });

  it("updates lead fields and logs status_changed, follow_up_set, & lead_updated activity entries", async () => {
    const lead = await Lead.create({
      name: "Patch Test Lead",
      email: "patch.test@example.co.za",
      source: "other",
      status: "new",
      followUpDate: null,
    });

    const newFollowUp = new Date("2026-10-01T00:00:00.000Z").toISOString();
    const res = await request(app)
      .patch(`/api/leads/${lead._id}`)
      .set("Cookie", authCookie)
      .send({
        name: "Patch Test Lead Renamed",
        status: "contacted",
        followUpDate: newFollowUp,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Patch Test Lead Renamed");
    assert.equal(res.body.status, "contacted");

    const statusActivity = await Activity.findOne({ leadId: lead._id, type: "status_changed" });
    assert.ok(statusActivity);
    assert.equal(statusActivity.meta?.from, "new");
    assert.equal(statusActivity.meta?.to, "contacted");

    const followUpActivity = await Activity.findOne({ leadId: lead._id, type: "follow_up_set" });
    assert.ok(followUpActivity);

    const updatedActivity = await Activity.findOne({ leadId: lead._id, type: "lead_updated" });
    assert.ok(updatedActivity);
    assert.ok(updatedActivity.meta?.fields.includes("name"));
  });
});

describe("Sub-routes: /api/leads/:id/notes & /api/leads/:id/activity", () => {
  it("GET /api/leads/:id/notes lists notes for a lead", async () => {
    const thandi = await Lead.findOne({ name: "Thandi Mokoena" });
    assert.ok(thandi);

    const res = await request(app)
      .get(`/api/leads/${thandi._id}/notes`)
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 2);
  });

  it("POST /api/leads/:id/notes creates a note and logs note_added activity", async () => {
    const thandi = await Lead.findOne({ name: "Thandi Mokoena" });
    assert.ok(thandi);

    const res = await request(app)
      .post(`/api/leads/${thandi._id}/notes`)
      .set("Cookie", authCookie)
      .send({ body: "New note appended via API endpoint" });

    assert.equal(res.status, 201);
    assert.equal(res.body.body, "New note appended via API endpoint");
    assert.ok(res.body.id);

    const activity = await Activity.findOne({
      leadId: thandi._id,
      type: "note_added",
      "meta.noteId": new mongoose.Types.ObjectId(res.body.id),
    });
    assert.ok(activity);
  });

  it("GET /api/leads/:id/activity returns paginated activity timeline", async () => {
    const thandi = await Lead.findOne({ name: "Thandi Mokoena" });
    assert.ok(thandi);

    const res = await request(app)
      .get(`/api/leads/${thandi._id}/activity`)
      .set("Cookie", authCookie);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });
});

describe("DELETE /api/leads/:id", () => {
  it("returns 404 NOT_FOUND for a non-existent lead", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .delete(`/api/leads/${nonExistentId}`)
      .set("Cookie", authCookie);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  it("deletes a lead and cascade-deletes its notes and activity", async () => {
    const lead = await Lead.create({
      name: "Delete Cascade Lead",
      email: "delete.cascade@example.co.za",
      source: "whatsapp",
    });

    const note = await Note.create({
      leadId: lead._id,
      body: "Test note for cascade delete",
    });

    const activity = await Activity.create({
      leadId: lead._id,
      type: "lead_created",
    });

    const res = await request(app)
      .delete(`/api/leads/${lead._id}`)
      .set("Cookie", authCookie);

    assert.equal(res.status, 204);

    const deletedLead = await Lead.findById(lead._id);
    assert.equal(deletedLead, null);

    const remainingNotes = await Note.find({ leadId: lead._id });
    assert.equal(remainingNotes.length, 0);

    const remainingActivity = await Activity.find({ leadId: lead._id });
    assert.equal(remainingActivity.length, 0);
  });
});

describe("Additional Phase 3 DoD Assertion Tests", () => {
  it("POST /api/leads with invalid status returns 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/leads")
      .set("Cookie", authCookie)
      .send({ name: "Banana Lead", email: "banana@example.co.za", source: "other", status: "banana" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields.status);
  });

  it("PATCH /api/leads/:id with explicit lastContactedAt does not overwrite with auto-set date", async () => {
    const lead = await Lead.create({
      name: "Explicit Date Lead",
      email: "explicit@example.co.za",
      source: "referral",
      status: "new",
    });

    const explicitDate = new Date("2026-01-01T00:00:00.000Z").toISOString();
    const res = await request(app)
      .patch(`/api/leads/${lead._id}`)
      .set("Cookie", authCookie)
      .send({ status: "contacted", lastContactedAt: explicitDate });

    assert.equal(res.status, 200);
    assert.equal(new Date(res.body.lastContactedAt).toISOString(), explicitDate);
  });

  it("PATCH /api/leads/:id with unknown field returns 400 VALIDATION_ERROR naming the field", async () => {
    const lead = await Lead.create({
      name: "Unknown Field Lead",
      email: "unknown@example.co.za",
      source: "referral",
    });

    const res = await request(app)
      .patch(`/api/leads/${lead._id}`)
      .set("Cookie", authCookie)
      .send({ phoneNumber: "0821234567" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields.phoneNumber);
  });

  it("POST /api/leads/:id/notes with empty/whitespace body returns 400 VALIDATION_ERROR", async () => {
    const thandi = await Lead.findOne({ name: "Thandi Mokoena" });
    assert.ok(thandi);

    const res = await request(app)
      .post(`/api/leads/${thandi._id}/notes`)
      .set("Cookie", authCookie)
      .send({ body: "   " });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields.body);
  });

  it("all protected lead routes return 401 UNAUTHORIZED without auth cookie", async () => {
    const sampleId = "64f1c2b7a1e4d2f8b3c9a001";
    const routes = [
      { method: "get", path: "/api/leads" },
      { method: "post", path: "/api/leads" },
      { method: "get", path: `/api/leads/${sampleId}` },
      { method: "patch", path: `/api/leads/${sampleId}` },
      { method: "delete", path: `/api/leads/${sampleId}` },
      { method: "get", path: `/api/leads/${sampleId}/notes` },
      { method: "post", path: `/api/leads/${sampleId}/notes` },
      { method: "get", path: `/api/leads/${sampleId}/activity` },
    ];

    for (const r of routes) {
      const res = await request(app)[r.method](r.path);
      assert.equal(res.status, 401, `${r.method.toUpperCase()} ${r.path} should require auth`);
      assert.equal(res.body.error.code, "UNAUTHORIZED");
    }
  });
});

