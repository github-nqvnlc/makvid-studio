import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";
const handler = (req: Request) => auth().handler(req);
export const { GET, POST } = toNextJsHandler(handler);
