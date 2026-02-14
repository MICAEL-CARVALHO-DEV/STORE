function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlXml(loc, changefreq, priority, lastmod) {
  const parts = [];
  parts.push("  <url>");
  parts.push(`    <loc>${escapeXml(loc)}</loc>`);
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${escapeXml(changefreq)}</changefreq>`);
  if (priority != null) parts.push(`    <priority>${escapeXml(priority)}</priority>`);
  parts.push("  </url>");
  return parts.join("\n");
}

async function fetchPublicProducts(base) {
  const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || "").trim();

  if (!/^https:\/\//i.test(SUPABASE_URL) || SUPABASE_ANON_KEY.length < 20) {
    return [];
  }

  const url =
    SUPABASE_URL +
    "/rest/v1/products?select=id,updated_at&is_active=eq.true&order=id.asc&limit=2000";

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) return [];

  const rows = await resp.json().catch(() => []);
  if (!Array.isArray(rows)) return [];

  return rows
    .map((r) => ({
      id: r && r.id != null ? String(r.id) : "",
      updated_at: r && r.updated_at ? String(r.updated_at) : "",
      loc: `${base}/detalhe-produto.html?id=${encodeURIComponent(String(r.id))}`,
    }))
    .filter((p) => p.id);
}

module.exports = async function handler(req, res) {
  const proto = (req.headers["x-forwarded-proto"] || "https").toString();
  const host = (req.headers["host"] || "").toString();
  const base = host ? `${proto}://${host}` : "https://example.com";

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");

  const staticUrls = [
    { loc: `${base}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${base}/index.html`, changefreq: "daily", priority: "1.0" },
    { loc: `${base}/detalhe-produto.html`, changefreq: "daily", priority: "0.7" },
    { loc: `${base}/login.html`, changefreq: "monthly", priority: "0.3" },
    { loc: `${base}/cadastro.html`, changefreq: "monthly", priority: "0.3" },
  ];

  let productUrls = [];
  try {
    productUrls = await fetchPublicProducts(base);
  } catch (e) {
    productUrls = [];
  }

  const urlsXml = [];
  staticUrls.forEach((u) => {
    urlsXml.push(buildUrlXml(u.loc, u.changefreq, u.priority));
  });

  productUrls.forEach((p) => {
    const lastmod = p.updated_at ? new Date(p.updated_at).toISOString() : null;
    urlsXml.push(buildUrlXml(p.loc, "weekly", "0.8", lastmod));
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlsXml.join("\n"),
    "</urlset>",
    "",
  ].join("\n");

  res.status(200).send(xml);
};

