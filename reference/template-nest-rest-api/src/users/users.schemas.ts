import { type } from "arktype";

export const publicUserSchema = type({
  "+": "delete",
  createdAt: "Date",
  email: "string.email",
  id: "string.uuid",
});

export type PublicUser = typeof publicUserSchema.infer;
