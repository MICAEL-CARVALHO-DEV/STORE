module.exports = async function handler(req, res) {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");

  // This is a public runtime config. Do NOT put service_role here.
  const safeUrl = /^https:\/\//i.test(url) ? url : "";
  const safeKey = anonKey.length >= 20 ? anonKey : "";

  res.status(200).send(
    [
      "/* Runtime Supabase config (Vercel) */",
      "window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {};",
      `window.SUPABASE_CONFIG.url = ${JSON.stringify(safeUrl)};`,
      `window.SUPABASE_CONFIG.anonKey = ${JSON.stringify(safeKey)};`,
      "",
    ].join("\n"),
  );
};

