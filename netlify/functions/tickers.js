// netlify/functions/tickers.js
// Fetch MEXC / Gate.io / Bitget prices in parallel and return once.
import { Agent, fetch as undiciFetch } from "undici";

const agent = new Agent({ keepAlive: true, keepAliveTimeout: 10_000 });
const HEADERS = { Accept: "application/json" };

const ENDPOINTS = {
  mexc:  "https://api.mexc.com/api/v3/ticker/24hr?symbol=COAIUSDT",
  gate:  "https://api.gateio.ws/api/v4/spot/tickers?currency_pair=COAI_USDT",
  bitget:"https://api.bitget.com/api/v2/spot/market/tickers?symbol=COAIUSDT",

  ,
  bybit: "https://api.bybit.com/v5/market/tickers?category=spot&symbol=COAIUSDT",
  kucoin:"https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=COAI-USDT"
};

export async function handler() {
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 1500); // 1.5s timeout
    const opts = { headers: HEADERS, dispatcher: agent, signal: ac.signal };

    const [mx, gt, bg] = await Promise.allSettled([
      undiciFetch(ENDPOINTS.mexc,  opts).then(r=>r.json()),
      undiciFetch(ENDPOINTS.gate,  opts).then(r=>r.json()),
      undiciFetch(ENDPOINTS.bitget,opts).then(r=>r.json()),
    ]);
    clearTimeout(to);

    const mexc   = mx.status === "fulfilled" ? Number(mx.value?.lastPrice) : null;
    const gate   = gt.status === "fulfilled" ? Number((Array.isArray(gt.value) ? gt.value[0] : null)?.last) : null;
    const bitget = bg.status === "fulfilled" ? Number(bg.value?.data?.[0]?.lastPr || bg.value?.data?.[0]?.last) : null;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=0, s-maxage=1, stale-while-revalidate=5",
      },
      body: JSON.stringify({ mexc, gate, bitget, ts: Date.now() }),
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
