export async function handler(event) {
  try {
    const { url } = event.queryStringParameters || {};
    if (!url) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing url param" })
      };
    }

    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid URL format" })
      };
    }

    // Etherscan/BscScan API 키 자동 주입
    if (u.hostname === "api.etherscan.io" || u.hostname === "api.bscscan.com") {
      const params = u.searchParams;
      const key = process.env.ETHERSCAN_KEY || process.env.BSCSCAN_KEY;
      if (key && !params.get("apikey")) {
        params.set("apikey", key);
      }
      u.search = params.toString();
    }

    const r = await fetch(u.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000) // 10초 타임아웃
    });

    const data = await r.text();
    return {
      statusCode: r.status,
      body: data,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store"
      }
    };
  } catch (e) {
    if (e.name === "AbortError" || e.name === "TimeoutError") {
      return {
        statusCode: 504,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Request timeout" })
      };
    }
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e.message || e) })
    };
  }
}
