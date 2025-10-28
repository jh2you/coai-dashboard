// netlify/functions/get-coai.js (robust w/ retries & backoff)
const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";
const BSC_CHAIN_ID = 56;

// Small sleep helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fetch JSON with retries (handles Etherscan rate limit flakiness)
async function fetchJSON(url, { tries = 4, backoff = 250 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const js = await res.json();

      // Etherscan 'status:0' often means rate limit or empty
      if (typeof js === "object" && js && js.status === "0") {
        const msg = (js.message || "") + " " + (js.result || "");
        if (/rate limit|Max rate|limit reached/i.test(msg)) throw new Error("RATE_LIMIT");
      }
      return js;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(backoff * Math.pow(2, i)); // 250, 500, 1000...
    }
  }
  throw lastErr || new Error("fetchJSON failed");
}

async function tokenTxs(contract, address, apiKey, page = 1, offset = 1000) {
  const u = new URL(ETHERSCAN_V2_API);
  u.searchParams.set("chainid", BSC_CHAIN_ID);
  u.searchParams.set("module", "account");
  u.searchParams.set("action", "tokentx");
  u.searchParams.set("contractaddress", contract);
  u.searchParams.set("address", address.toLowerCase());
  u.searchParams.set("page", page);
  u.searchParams.set("offset", offset);
  u.searchParams.set("sort", "desc");
  u.searchParams.set("apikey", apiKey);
  const js = await fetchJSON(u.toString());
  if (js.status !== "1") return [];
  return js.result || [];
}

async function tokenBalance(contract, address, apiKey) {
  const u = new URL(ETHERSCAN_V2_API);
  u.searchParams.set("chainid", BSC_CHAIN_ID);
  u.searchParams.set("module", "account");
  u.searchParams.set("action", "tokenbalance");
  u.searchParams.set("contractaddress", contract);
  u.searchParams.set("address", address.toLowerCase());
  u.searchParams.set("tag", "latest");
  u.searchParams.set("apikey", apiKey);
  const js = await fetchJSON(u.toString());
  return js && js.result ? js.result : "0";
}

exports.handler = async (event) => {
  try {
    const apiKey = process.env.ETHERSCAN_KEY;
    if (!apiKey) return { statusCode: 500, body: "Missing ETHERSCAN_KEY env" };

    const qp = event.queryStringParameters || {};
    const contract = (qp.contract || process.env.COAI_CONTRACT || "0xd82544bf0dfe8385ef8fa34d67e6e4940cc63e16").toLowerCase();
    const hours = Number(qp.hours || process.env.COAI_HOURS || 24);

    // wallets: Label:0x...,Label2:0x...
    const walletsParam = qp.wallets || "";
    if (!walletsParam) return { statusCode: 400, body: "Query param 'wallets' required" };
    const pairs = walletsParam.split(",").map(s => {
      const [label, addr] = s.split(":");
      return { label: (label || "Wallet").trim(), addr: (addr || "").trim().toLowerCase() };
    });

    // Infer decimals/symbol from first address tx (fallbacks)
    let decimals = 18, symbol = "TOKEN";
    try {
      const sample = await tokenTxs(contract, pairs[0].addr || "0x0000000000000000000000000000000000000000", apiKey, 1, 1);
      if (sample[0]?.tokenDecimal) decimals = Number(sample[0].tokenDecimal);
      if (sample[0]?.tokenSymbol)  symbol  = String(sample[0].tokenSymbol);
    } catch { /* keep defaults */ }

    const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;

    const results = [];
    for (const { label, addr } of pairs) {
      // Balance
      const raw = await tokenBalance(contract, addr, apiKey);
      const balance = Number(raw) / 10 ** decimals;

      // Flow: paginate newest->oldest until crossing cutoff
      let page = 1, maxPages = 10, inSum = 0, outSum = 0;
      while (page <= maxPages) {
        const txs = await tokenTxs(contract, addr, apiKey, page, 1000);
        if (!txs.length) break;

        let crossed = false;
        for (const tx of txs) {
          const ts = Number(tx.timeStamp);
          if (ts < cutoff) { crossed = true; break; }
          const val = Number(tx.value) / 10 ** decimals;
          if ((tx.to || "").toLowerCase() === addr) inSum += val;
          if ((tx.from || "").toLowerCase() === addr) outSum += val;
        }
        if (crossed) break;
        page++;
      }

      results.push({
        exchange: label, wallet: addr, symbol, decimals,
        balance: Number(balance.toFixed(6)),
        totalIn: Number(inSum.toFixed(6)),
        totalOut: Number(outSum.toFixed(6)),
        netFlow: Number((inSum - outSum).toFixed(6)),
      });
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify({ contract, hours, updatedAt: Date.now(), results })
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
};
