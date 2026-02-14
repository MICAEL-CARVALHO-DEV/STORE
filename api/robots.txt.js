module.exports = async function handler(req, res) {
  const proto = (req.headers["x-forwarded-proto"] || "https").toString();
  const host = (req.headers["host"] || "").toString();
  const base = host ? `${proto}://${host}` : "https://example.com";

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");

  // Avoid indexing private areas.
  res.status(200).send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin.html",
      "Disallow: /checkout.html",
      "Disallow: /minha-conta.html",
      "",
      `Sitemap: ${base}/sitemap.xml`,
      "",
    ].join("\n"),
  );
};

