import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const { supabase } = await import("./_supabase");

    const { data, error } = await supabase
      .from("cron_status")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Table exists but no row yet — not an error
        return res.status(200).json({ ok: true, data: null });
      }
      return res.status(200).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(200).json({ ok: false, error: msg });
  }
}
