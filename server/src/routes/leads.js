import { Router } from "express";
import { z } from "zod";
import { Lead, Note, Activity } from "../models/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, validate, notFound } from "../utils/errors.js";

const router = Router();

router.use(requireAuth);

const isValidObjectId = (id) => typeof id === "string" && /^[a-f0-9]{24}$/.test(id);
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createLeadSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(1, "Name is required").max(120, "Name cannot exceed 120 characters").trim(),
  email: z.string({ required_error: "Email is required" }).email("Invalid email address").trim().toLowerCase(),
  phone: z.string().max(30, "Phone cannot exceed 30 characters").trim().nullable().optional(),
  company: z.string().max(120, "Company cannot exceed 120 characters").trim().nullable().optional(),
  source: z.enum(["contact-form", "referral", "whatsapp", "other"], { required_error: "Source is required" }),
  status: z.enum(["new", "contacted", "converted", "lost"]).optional().default("new"),
  followUpDate: z.string().nullable().optional().transform((val) => (val ? new Date(val) : val)),
});

const updateLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(120, "Name cannot exceed 120 characters").trim().optional(),
  email: z.string().email("Invalid email address").trim().toLowerCase().optional(),
  phone: z.string().max(30, "Phone cannot exceed 30 characters").trim().nullable().optional(),
  company: z.string().max(120, "Company cannot exceed 120 characters").trim().nullable().optional(),
  source: z.enum(["contact-form", "referral", "whatsapp", "other"]).optional(),
  status: z.enum(["new", "contacted", "converted", "lost"]).optional(),
  followUpDate: z.string().nullable().optional().transform((val) => (val !== undefined ? (val ? new Date(val) : null) : undefined)),
  lastContactedAt: z.string().nullable().optional().transform((val) => (val !== undefined ? (val ? new Date(val) : null) : undefined)),
});

const createNoteSchema = z.object({
  body: z.string({ required_error: "Note body is required" }).min(1, "Note body is required").max(2000, "Note body cannot exceed 2000 characters").trim(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.source) {
      filter.source = req.query.source;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { company: searchRegex },
      ];
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const pipeline = [];
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    if (req.query.sort === "followUpDate_asc") {
      pipeline.push({
        $addFields: {
          hasFollowUp: { $cond: [{ $eq: ["$followUpDate", null] }, 1, 0] },
        },
      });
      pipeline.push({
        $sort: { hasFollowUp: 1, followUpDate: 1, createdAt: -1 },
      });
    } else if (req.query.sort === "createdAt_asc") {
      pipeline.push({ $sort: { createdAt: 1 } });
    } else if (req.query.sort === "name_asc") {
      pipeline.push({ $sort: { name: 1 } });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push({ $skip: offset });
    pipeline.push({ $limit: limit });

    const [total, results] = await Promise.all([
      Lead.countDocuments(filter),
      Lead.aggregate(pipeline),
    ]);

    const leads = results.map((doc) => {
      delete doc.hasFollowUp;
      doc.id = doc._id.toString();
      delete doc._id;
      delete doc.__v;
      return doc;
    });

    res.json({
      data: leads,
      total,
      limit,
      offset,
    });
  })
);

router.post(
  "/",
  validate(createLeadSchema),
  asyncHandler(async (req, res) => {
    const lead = await Lead.create(req.body);

    try {
      await Activity.create({
        leadId: lead._id,
        actorId: req.user._id,
        type: "lead_created",
        meta: { source: lead.source },
      });
    } catch (err) {
      console.error("Activity logging failed:", err.message);
    }

    res.status(201).json(lead);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw notFound("Lead not found");
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    const [notes, activity] = await Promise.all([
      Note.find({ leadId: lead._id }).sort({ createdAt: -1 }),
      Activity.find({ leadId: lead._id }).sort({ createdAt: -1 }),
    ]);

    res.json({
      ...lead.toJSON(),
      notes,
      activity,
    });
  })
);

router.patch(
  "/:id",
  validate(updateLeadSchema),
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw notFound("Lead not found");
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    if (req.body.status === "contacted" && req.body.lastContactedAt === undefined) {
      req.body.lastContactedAt = new Date();
    }

    const oldStatus = lead.status;
    const statusChanged = req.body.status && req.body.status !== oldStatus;

    const oldFollowUp = lead.followUpDate;
    const newFollowUp = req.body.followUpDate;
    const followUpChanged =
      newFollowUp !== undefined &&
      (newFollowUp === null
        ? oldFollowUp !== null
        : !oldFollowUp || new Date(newFollowUp).getTime() !== new Date(oldFollowUp).getTime());

    const oldValues = {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
    };

    Object.assign(lead, req.body);
    await lead.save();

    const updatedFields = ["name", "email", "phone", "company", "source"];
    const changedFields = updatedFields.filter(
      (f) => req.body[f] !== undefined && String(req.body[f]) !== String(oldValues[f])
    );

    if (changedFields.length > 0) {
      try {
        await Activity.create({
          leadId: lead._id,
          actorId: req.user._id,
          type: "lead_updated",
          meta: { fields: changedFields },
        });
      } catch (err) {
        console.error("Activity logging failed:", err.message);
      }
    }

    if (statusChanged) {
      try {
        await Activity.create({
          leadId: lead._id,
          actorId: req.user._id,
          type: "status_changed",
          meta: { from: oldStatus, to: lead.status },
        });
      } catch (err) {
        console.error("Activity logging failed:", err.message);
      }
    }

    if (followUpChanged) {
      try {
        await Activity.create({
          leadId: lead._id,
          actorId: req.user._id,
          type: "follow_up_set",
          meta: { from: oldFollowUp, to: lead.followUpDate },
        });
      } catch (err) {
        console.error("Activity logging failed:", err.message);
      }
    }

    res.json(lead);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw notFound("Lead not found");
    }

    const lead = await Lead.findOneAndDelete({ _id: req.params.id });
    if (!lead) {
      throw notFound("Lead not found");
    }

    res.status(204).end();
  })
);

router.get(
  "/:id/notes",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw notFound("Lead not found");
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    const notes = await Note.find({ leadId: lead._id }).sort({ createdAt: -1 });
    res.json(notes);
  })
);

router.post(
  "/:id/notes",
  validate(createNoteSchema),
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw notFound("Lead not found");
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    const note = await Note.create({
      leadId: lead._id,
      authorId: req.user._id,
      source: "admin",
      body: req.body.body,
    });

    try {
      await Activity.create({
        leadId: lead._id,
        actorId: req.user._id,
        type: "note_added",
        meta: { noteId: note._id },
      });
    } catch (err) {
      console.error("Activity logging failed:", err.message);
    }

    res.status(201).json(note);
  })
);

router.get(
  "/:id/activity",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw notFound("Lead not found");
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const activity = await Activity.find({ leadId: lead._id })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    res.json(activity);
  })
);

export default router;
