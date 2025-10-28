export async function handler(event) {
  try {
    const { url } = event.queryStringParameters || {};
    if (!url) return { statusCode: 400, body: "Missing url param" };
    const u = new URL(url);
    if (u.hostname === "api.etherscan.io") {
      const params = u.searchParams;
      const key = process.env.ETHERSCAN_KEY || process.env.BSCSCAN_KEY;
      if (key && !params.get("apikey")) params.set("apikey", key);
      u.search = params.toString();
    }
    const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
    const data = await r.text();
    return { statusCode: r.status, body: data, headers: { "Content-Type": "application/json" } };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}