import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import { User, Lead, Note, Activity } from "../models/index.js";

export const daysFromNow = (days) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
};

export async function seedDatabase() {
  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Lead.deleteMany({}),
    Note.deleteMany({}),
    Activity.deleteMany({}),
  ]);
  console.log("Cleared existing User, Lead, Note, and Activity collections.");

  // 1. Create Admin User
  const passwordHash = await bcryptjs.hash("demo-password", 12);
  const admin = await User.create({
    name: "Zelamene Shazi",
    email: "admin@crm.local",
    passwordHash,
  });
  console.log(`Created admin user: ${admin.email} (${admin._id})`);

  // 2. Create 12 Leads (consistent .co.za domain)
  const leadsData = [
    {
      name: "Amahle Zulu",
      email: "amahle.zulu@example.co.za",
      phone: "0823344556",
      company: "Zulu Logistics",
      source: "whatsapp",
      status: "contacted",
      followUpDate: daysFromNow(-2), // Overdue
      lastContactedAt: daysFromNow(-5),
    },
    {
      name: "Precious Nkosi",
      email: "precious.nkosi@example.co.za",
      phone: "0835566778",
      company: "Nkosi Interiors",
      source: "contact-form",
      status: "contacted",
      followUpDate: daysFromNow(0), // Due today
      lastContactedAt: daysFromNow(-1),
    },
    {
      name: "Thandi Mokoena",
      email: "thandi@example.co.za",
      phone: "0821234567",
      company: "Mokoena Consulting",
      source: "referral",
      status: "contacted",
      followUpDate: daysFromNow(7), // Upcoming
      lastContactedAt: daysFromNow(-2),
    },
    {
      name: "Sipho Dlamini",
      email: "sipho.dlamini@example.co.za",
      phone: "0847788990",
      company: "Dlamini Tech",
      source: "contact-form",
      status: "new",
      followUpDate: daysFromNow(3), // Upcoming
      lastContactedAt: null,
    },
    {
      name: "Ahmed Patel",
      email: "ahmed.patel@example.co.za",
      phone: "0829988776",
      company: "Patel & Co",
      source: "referral",
      status: "contacted",
      followUpDate: daysFromNow(5), // Upcoming
      lastContactedAt: daysFromNow(-1),
    },
    {
      name: "Naledi Khumalo",
      email: "naledi.khumalo@example.co.za",
      phone: "0712233445",
      company: "Khumalo Legal",
      source: "referral",
      status: "converted",
      followUpDate: null,
      lastContactedAt: daysFromNow(-10),
    },
    {
      name: "Ryan van der Merwe",
      email: "ryan.vdm@example.co.za",
      phone: "0834455667",
      company: "Cape Timber",
      source: "other",
      status: "new",
      followUpDate: null,
      lastContactedAt: null,
    },
    {
      name: "Zanele Ndlovu",
      email: "zanele.ndlovu@example.co.za",
      phone: "0723344556",
      company: "Ndlovu Catering",
      source: "whatsapp",
      status: "lost",
      followUpDate: null,
      lastContactedAt: daysFromNow(-14),
    },
    {
      name: "Lerato Mthembu",
      email: "lerato.mthembu@example.co.za",
      phone: "0812233445",
      company: "Mthembu Solar",
      source: "contact-form",
      status: "new",
      followUpDate: null,
      lastContactedAt: null,
    },
    {
      name: "James Fourie",
      email: "james.fourie@example.co.za",
      phone: "0826677889",
      company: "Fourie Plumbing",
      source: "contact-form",
      status: "converted",
      followUpDate: null,
      lastContactedAt: daysFromNow(-8),
    },
    {
      name: "David Chen",
      email: "david.chen@example.co.za",
      phone: "0841122334",
      company: "Apex Media",
      source: "referral",
      status: "new",
      followUpDate: null,
      lastContactedAt: null,
    },
    {
      name: "Christo Botha",
      email: "christo.botha@example.co.za",
      phone: "0839900112",
      company: "Botha Electrical",
      source: "other",
      status: "new",
      followUpDate: null,
      lastContactedAt: null,
    },
  ];

  const createdLeads = await Lead.insertMany(leadsData);
  console.log(`Created ${createdLeads.length} leads.`);

  const leadByName = Object.fromEntries(createdLeads.map((l) => [l.name, l]));

  // 3. Create Notes for Thandi Mokoena
  const thandi = leadByName["Thandi Mokoena"];
  const notes = await Note.insertMany([
    {
      leadId: thandi._id,
      authorId: admin._id,
      source: "admin",
      body: "Referred by Sipho. Wants a quote for a website redesign before end of month.",
      createdAt: daysFromNow(-3),
    },
    {
      leadId: thandi._id,
      authorId: admin._id,
      source: "admin",
      body: "Sent initial quote on Tuesday. She's comparing with two other agencies.",
      createdAt: daysFromNow(-1),
    },
  ]);
  console.log(`Created ${notes.length} notes for ${thandi.name}.`);

  // 4. Create Activity records
  const activities = [];

  for (const lead of createdLeads) {
    // lead_created for every lead
    activities.push({
      leadId: lead._id,
      actorId: lead.source === "contact-form" ? null : admin._id,
      type: "lead_created",
      meta: { source: lead.source },
      createdAt: lead.createdAt || daysFromNow(-5),
    });

    // status_changed for leads not in 'new'
    if (lead.status !== "new") {
      activities.push({
        leadId: lead._id,
        actorId: admin._id,
        type: "status_changed",
        meta: { from: "new", to: lead.status },
        createdAt: lead.lastContactedAt || lead.updatedAt || daysFromNow(-2),
      });
    }

    // follow_up_set for leads with follow-up dates
    if (lead.followUpDate) {
      activities.push({
        leadId: lead._id,
        actorId: admin._id,
        type: "follow_up_set",
        meta: { from: null, to: lead.followUpDate },
        createdAt: lead.updatedAt || daysFromNow(-1),
      });
    }
  }

  // note_added for each created note
  for (const note of notes) {
    activities.push({
      leadId: note.leadId,
      actorId: note.authorId,
      type: "note_added",
      meta: { noteId: note._id },
      createdAt: note.createdAt,
    });
  }

  await Activity.insertMany(activities);
  console.log(`Created ${activities.length} activity records.`);

  const summary = {
    users: await User.countDocuments(),
    leads: await Lead.countDocuments(),
    notes: await Note.countDocuments(),
    activities: await Activity.countDocuments(),
  };

  console.log("\n================ SEED SUMMARY ================");
  console.log(`Users count     : ${summary.users}`);
  console.log(`Leads count     : ${summary.leads}`);
  console.log(`Notes count     : ${summary.notes}`);
  console.log(`Activities count: ${summary.activities}`);
  console.log("==============================================\n");

  return summary;


const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  dotenv.config();
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("MONGO_URI is not set. Aborting.");
    process.exit(1);
  }

  console.log(`About to wipe: ${uri.split("@")[1]?.split("/")[0] || uri}`);
  console.log("Ctrl+C to abort. Continuing in 2 seconds.");
  await new Promise((r) => setTimeout(r, 2000));

  try {
    await mongoose.connect(uri);
    const summary = await seedDatabase();
    console.log("\nDemo credentials:");
    console.log("  Email:    admin@crm.local");
    console.log("  Password: demo-password");
    console.log(
      `\nSummary: ${summary.users} users, ${summary.leads} leads, ${summary.notes} notes, ${summary.activities} activities\n`
    );
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database.");
  }

  process.exit(0);
}
