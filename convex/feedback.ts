import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const submit = mutation({
  args: {
    name: v.string(),
    message: v.string(),
    email: v.optional(v.string()),
    view: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const message = args.message.trim();
    if (!name) throw new Error("名前を入力してください");
    if (message.length < 3) throw new Error("修正意見を入力してください");
    const timestamp = Date.now();
    const feedbackId = await ctx.db.insert("feedbackItems", {
      name,
      message,
      email: cleanOptional(args.email),
      view: cleanOptional(args.view),
      createdBy: cleanOptional(args.createdBy),
      status: "new",
      createdAt: timestamp,
    });
    await ctx.db.insert("auditLogs", {
      actor: cleanOptional(args.createdBy) ?? name,
      action: "feedback.submit",
      detail: message.slice(0, 80),
      createdAt: timestamp,
    });
    return feedbackId;
  },
});

function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
