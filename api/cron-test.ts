import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({ ok: true, message: "hello from cron-test", time: Date.now() });
}
