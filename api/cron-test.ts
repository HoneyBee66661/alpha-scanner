export default async function handler(): Promise<Response> {
  return Response.json({ ok: true, message: "hello from cron-test", time: Date.now() });
}