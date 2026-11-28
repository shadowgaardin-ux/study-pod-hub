import { z } from "zod";

export const shareTokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "Invalid sharing link");
export const sharedEditSchema = z.object({
  token: shareTokenSchema,
  title: z.string().trim().min(1).max(200),
  transcript: z.string().max(200000).nullable(),
  summary: z.string().max(60000).nullable(),
  version: z.string().regex(/^[a-f0-9]{32}$/),
}).strict();