import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User, Lead, Note, Activity } from "../models/index.js";
import { seedDatabase } from "../scripts/seed.js";

test("Phase 1 DoD: Note and Activity schemas are immutable (no updatedAt)", () => {
  assert.strictEqual(Note.schema.path("updatedAt"), undefined, "Note schema must not have updatedAt");
  assert.strictEqual(Activity.schema.path("updatedAt"), undefined, "Activity schema must not have updatedAt");
  assert.ok(Note.schema.path("createdAt"), "Note schema must have createdAt");
  assert.ok(Activity.schema.path("createdAt"), "Activity schema must have createdAt");
});

test("Phase 1 DoD: Seed execution populates exactly 1 admin user, 12 leads, notes, and activity timeline", async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  try {
    const summary = await seedDatabase();

    // 1. Entity count assertions
    assert.strictEqual(summary.users, 1, "db.users.countDocuments() must return 1");
    assert.strictEqual(summary.leads, 12, "db.leads.countDocuments() must return 12");
    assert.strictEqual(summary.notes, 2, "Should create 2 notes for Thandi Mokoena");
    assert.strictEqual(summary.activities, 26, "Exact expected activity count is 26");

    // 2. Overdue follow-up assertion
    const amahle = await Lead.findOne({ name: "Amahle Zulu" });
    assert.ok(amahle, "Amahle Zulu should exist");
    assert.strictEqual(amahle.status, "contacted");
    assert.ok(amahle.followUpDate < new Date(), "Amahle's follow-up should be overdue (< now)");

    // 3. Due today follow-up assertion
    const precious = await Lead.findOne({ name: "Precious Nkosi" });
    assert.ok(precious, "Precious Nkosi should exist");
    assert.strictEqual(precious.status, "contacted");
    const today = new Date();
    assert.strictEqual(
      precious.followUpDate.toDateString(),
      today.toDateString(),
      "Precious's follow-up date should be today"
    );

    // 4. Notes & timeline for Thandi Mokoena
    const thandi = await Lead.findOne({ name: "Thandi Mokoena" });
    assert.ok(thandi, "Thandi Mokoena should exist");
    const thandiNotes = await Note.find({ leadId: thandi._id });
    assert.strictEqual(thandiNotes.length, 2, "Thandi must have 2 notes");

    const thandiActivities = await Activity.find({ leadId: thandi._id });
    assert.ok(thandiActivities.length >= 3, "Thandi must have multiple activity entries");
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
});

test("Phase 1 DoD: toJSON transform strips _id, __v, and passwordHash", async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  try {
    await seedDatabase();

    const userDoc = await User.findOne();
    assert.ok(userDoc, "User should exist after seed");
    const userJson = userDoc.toJSON();

    assert.ok(userJson.id, "User JSON should have id");
    assert.strictEqual(userJson._id, undefined, "User JSON should not have _id");
    assert.strictEqual(userJson.__v, undefined, "User JSON should not have __v");
    assert.strictEqual(userJson.passwordHash, undefined, "User JSON should not have passwordHash");

    const leadDoc = await Lead.findOne();
    assert.ok(leadDoc, "Lead should exist after seed");
    const leadJson = leadDoc.toJSON();

    assert.ok(leadJson.id, "Lead JSON should have id");
    assert.strictEqual(leadJson._id, undefined, "Lead JSON should not have _id");
    assert.strictEqual(leadJson.__v, undefined, "Lead JSON should not have __v");

    const noteDoc = await Note.findOne();
    assert.ok(noteDoc, "Note should exist after seed");
    const noteJson = noteDoc.toJSON();
    assert.ok(noteJson.id, "Note JSON should have id");
    assert.strictEqual(noteJson._id, undefined, "Note JSON should not have _id");
    assert.strictEqual(noteJson.__v, undefined, "Note JSON should not have __v");

    const activityDoc = await Activity.findOne();
    assert.ok(activityDoc, "Activity should exist after seed");
    const activityJson = activityDoc.toJSON();
    assert.ok(activityJson.id, "Activity JSON should have id");
    assert.strictEqual(activityJson._id, undefined, "Activity JSON should not have _id");
    assert.strictEqual(activityJson.__v, undefined, "Activity JSON should not have __v");
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
});

test("Phase 1 DoD: Deleting a lead cascades to its notes and activity", async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  try {
    await seedDatabase();

    const thandi = await Lead.findOne({ name: "Thandi Mokoena" });
    const notesBefore = await Note.countDocuments({ leadId: thandi._id });
    const activityBefore = await Activity.countDocuments({ leadId: thandi._id });

    assert.ok(notesBefore > 0, "Thandi should have notes before deletion");
    assert.ok(activityBefore > 0, "Thandi should have activity before deletion");

    await Lead.findOneAndDelete({ _id: thandi._id });

    const notesAfter = await Note.countDocuments({ leadId: thandi._id });
    const activityAfter = await Activity.countDocuments({ leadId: thandi._id });

    assert.strictEqual(notesAfter, 0, "Notes should be cascade-deleted");
    assert.strictEqual(activityAfter, 0, "Activity should be cascade-deleted");
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
});
