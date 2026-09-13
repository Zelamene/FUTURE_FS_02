import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User, Lead, Note, Activity } from "../models/index.js";

let mongod;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test("Phase 1 DoD: All four model files load properly", () => {
  assert.ok(User, "User model should be defined");
  assert.ok(Lead, "Lead model should be defined");
  assert.ok(Note, "Note model should be defined");
  assert.ok(Activity, "Activity model should be defined");
});

test("Phase 1 DoD: Lead has indexes on { status: 1, followUpDate: 1 } and { createdAt: -1 }", () => {
  const indexes = Lead.schema.indexes();
  const hasStatusFollowUp = indexes.some(
    ([fields]) => fields.status === 1 && fields.followUpDate === 1
  );
  const hasCreatedAt = indexes.some(
    ([fields]) => fields.createdAt === -1
  );

  assert.ok(hasStatusFollowUp, "Lead must have index on { status: 1, followUpDate: 1 }");
  assert.ok(hasCreatedAt, "Lead must have index on { createdAt: -1 }");
});

test("Phase 1 DoD: Note and Activity have indexes on { leadId: 1, createdAt: -1 } and no redundant leadId index", () => {
  const noteIndexes = Note.schema.indexes();
  const hasNoteCompound = noteIndexes.some(
    ([fields]) => fields.leadId === 1 && fields.createdAt === -1
  );
  const hasNoteSingleLeadId = noteIndexes.some(
    ([fields]) => fields.leadId === 1 && Object.keys(fields).length === 1
  );

  assert.ok(hasNoteCompound, "Note must have compound index on { leadId: 1, createdAt: -1 }");
  assert.ok(!hasNoteSingleLeadId, "Note must not have redundant single index on leadId");

  const activityIndexes = Activity.schema.indexes();
  const hasActivityCompound = activityIndexes.some(
    ([fields]) => fields.leadId === 1 && fields.createdAt === -1
  );
  const hasActivitySingleLeadId = activityIndexes.some(
    ([fields]) => fields.leadId === 1 && Object.keys(fields).length === 1
  );

  assert.ok(hasActivityCompound, "Activity must have compound index on { leadId: 1, createdAt: -1 }");
  assert.ok(!hasActivitySingleLeadId, "Activity must not have redundant single index on leadId");
});

test("Phase 1 DoD: Note and Activity do not have an updatedAt field (immutable)", () => {
  assert.strictEqual(Note.schema.path("updatedAt"), undefined, "Note schema must not have updatedAt");
  assert.strictEqual(Activity.schema.path("updatedAt"), undefined, "Activity schema must not have updatedAt");
  assert.ok(Note.schema.path("createdAt"), "Note schema must have createdAt");
  assert.ok(Activity.schema.path("createdAt"), "Activity schema must have createdAt");
});

test("Phase 1 DoD: Every model's toJSON transform renames _id to id, strips __v, and strips passwordHash (User)", async () => {
  const user = new User({
    name: "Test User",
    email: "test@example.com",
    passwordHash: "secretHash123",
  });
  const userJson = user.toJSON();
  assert.strictEqual(userJson.id, user._id.toString());
  assert.strictEqual(userJson._id, undefined);
  assert.strictEqual(userJson.__v, undefined);
  assert.strictEqual(userJson.passwordHash, undefined);

  const lead = new Lead({
    name: "Test Lead",
    email: "lead@example.com",
    source: "referral",
    status: "new",
  });
  const leadJson = lead.toJSON();
  assert.strictEqual(leadJson.id, lead._id.toString());
  assert.strictEqual(leadJson._id, undefined);
  assert.strictEqual(leadJson.__v, undefined);

  const note = new Note({
    leadId: lead._id,
    body: "Test note body",
  });
  const noteJson = note.toJSON();
  assert.strictEqual(noteJson.id, note._id.toString());
  assert.strictEqual(noteJson._id, undefined);
  assert.strictEqual(noteJson.__v, undefined);

  const activity = new Activity({
    leadId: lead._id,
    type: "lead_created",
  });
  const activityJson = activity.toJSON();
  assert.strictEqual(activityJson.id, activity._id.toString());
  assert.strictEqual(activityJson._id, undefined);
  assert.strictEqual(activityJson.__v, undefined);
});

test("Phase 1 DoD: Deleting a lead via findOneAndDelete cascades to its notes and activity (count returns 0)", async () => {
  const lead = await Lead.create({
    name: "Cascade Target",
    email: "cascade@example.com",
    source: "other",
    status: "new",
  });

  await Note.create([
    { leadId: lead._id, body: "Note 1" },
    { leadId: lead._id, body: "Note 2" },
  ]);

  await Activity.create([
    { leadId: lead._id, type: "lead_created" },
    { leadId: lead._id, type: "note_added" },
  ]);

  const initialNotes = await Note.countDocuments({ leadId: lead._id });
  const initialActivities = await Activity.countDocuments({ leadId: lead._id });
  assert.strictEqual(initialNotes, 2);
  assert.strictEqual(initialActivities, 2);

  // Trigger cascade deletion using Lead.findOneAndDelete
  await Lead.findOneAndDelete({ _id: lead._id });

  const remainingLead = await Lead.findById(lead._id);
  const remainingNotes = await Note.countDocuments({ leadId: lead._id });
  const remainingActivities = await Activity.countDocuments({ leadId: lead._id });

  assert.strictEqual(remainingLead, null, "Lead should be deleted");
  assert.strictEqual(remainingNotes, 0, "All associated notes should be deleted");
  assert.strictEqual(remainingActivities, 0, "All associated activities should be deleted");
});
