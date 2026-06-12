/** Auth.js catch-all route handler — delegates GET/POST to NextAuth. */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
