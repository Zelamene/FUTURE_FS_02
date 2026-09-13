import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    source: {
      type: String,
      enum: ["admin", "capture"],
      default: "admin",
    },
    body: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 2000,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index
noteSchema.index({ leadId: 1, createdAt: -1 });

noteSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Note = mongoose.model("Note", noteSchema);
export default Note;
