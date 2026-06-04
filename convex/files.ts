import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachUploadedFile = mutation({
  args: {
    applicationId: v.id("applications"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    kind: v.union(v.literal("application_pdf"), v.literal("attachment"), v.literal("export")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("uploadedFiles", {
      applicationId: args.applicationId,
      storageId: args.storageId,
      filename: args.filename,
      contentType: args.contentType,
      kind: args.kind,
      createdAt: Date.now(),
    });
  },
});
