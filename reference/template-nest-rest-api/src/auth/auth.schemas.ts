import { type } from "arktype";

export const credentialsSchema = type({
  email: "string.email",
  password: "8 <= string <= 128",
});

export type Credentials = typeof credentialsSchema.infer;

export const accessTokenSchema = type({ accessToken: "string" });
