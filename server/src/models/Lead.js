import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 120,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      maxlength: 30,
      trim: true,
      default: null,
    },
    company: {
      type: String,
      maxlength: 120,
      trim: true,
      default: null,
    },
    source: {
      type: String,
      enum: ["contact-form", "referral", "whatsapp", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["new", "contacted", "converted", "lost"],
      default: "new",
      required: true,
    },
    followUpDate: {
      type: Date,
      default: null,
    },
    lastContactedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
leadSchema.index({ status: 1, followUpDate: 1 });
leadSchema.index({ createdAt: -1 });

// Cascade delete lives on findOneAndDelete only.
// The API's delete route must use Lead.findOneAndDelete().
// Do not add a deleteOne route without also handling cascade.
leadSchema.pre("findOneAndDelete", async function () {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await mongoose.model("Note").deleteMany({ leadId: doc._id });
    await mongoose.model("Activity").deleteMany({ leadId: doc._id });
  }
});

leadSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Lead = mongoose.model("Lead", leadSchema);
export default Lead;
