import { Activity } from "../models/index.js";
import { emit } from "../realtime/broadcaster.js";

export async function recordActivity(data) {
  try {
    const activity = await Activity.create(data);
    try {
      emit("activity.created", {
        leadId: activity.leadId.toString(),
        activity: activity.toJSON(),
      });
    } catch (err) {
      console.error("SSE emit failed for activity.created:", err.message);
    }
    return activity;
  } catch (err) {
    console.error("Activity logging failed:", err.message);
    return null;
  }
}
