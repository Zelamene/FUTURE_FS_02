import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User, Lead } from "../models/index.js";
import app from "../index.js";

test("Phase 1 DoD: A temporary debug route proves toJSON strips passwordHash and _id", async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const bcryptjs = (await import("bcryptjs")).default;
  const passwordHash = await bcryptjs.hash("demo-password", 12);

  await User.create({
    name: "Zelamene Shazi",
    email: "admin@crm.local",
    passwordHash,
  });

  await Lead.create({
    name: "Thandi Mokoena",
    email: "thandi@example.co.za",
    source: "referral",
    status: "contacted",
  });

  const res = await request(app).get("/api/_debug/models");
  assert.strictEqual(res.status, 200);

  const { user, lead } = res.body;
  assert.ok(user, "User should be returned");
  assert.strictEqual(user.email, "admin@crm.local");
  assert.strictEqual(user.passwordHash, undefined, "passwordHash must be stripped");
  assert.strictEqual(user._id, undefined, "_id must be stripped");
  assert.strictEqual(user.__v, undefined, "__v must be stripped");
  assert.ok(user.id, "id must be present");

  assert.ok(lead, "Lead should be returned");
  assert.strictEqual(lead.name, "Thandi Mokoena");
  assert.strictEqual(lead._id, undefined, "_id must be stripped");
  assert.strictEqual(lead.__v, undefined, "__v must be stripped");
  assert.ok(lead.id, "id must be present");

  await mongoose.disconnect();
  await mongod.stop();
});
