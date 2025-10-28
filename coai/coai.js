// coai/coai.js (single-flight, disable button, totals, 2 decimals, no USD)
async function coaiRender(opts = {}) {
  const {
    el = document.getElementById('coai-section'),
    wallets = "MEXC:0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB,Bitget:0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23,Gate.io:0x0D0707963952f2fBA59dD06f2b425ace40b492Fe,Cold:0xffa8DB7B38579e6A2D14f9B347a9acE4d044cD54",
    hours = 24,
    contract = (localStorage.getItem("coai_contract") || "0x0a8d6c86e1bce73fe4d0bd531e1a567306836ea5") // TODO: COAI 토큰 컨트랙트 주소로 교체하세요.
  } = opts;

  if (!el) return;

  el.innerHTML = `
    <div class="coai-wrap">
      <div class="coai-controls">
        <input class="coai-input" id="coai-wallets" size="90" value="${wallets}" />
        <input class="coai-hours" id="coai-hours" type="number" value="${hours}" min="1" step="1" />
        <button class="coai-btn" id="coai-go">Load</button>
        <span id="coai-status" style="margin-left:8px;opacity:.8"></span>
      </div>
      <table class="coai-table" id="coai-table">
        <thead>
          <tr>
            <th>#</th><th>Exchange</th><th>Wallet</th>
            <th class="coai-mono">Balance (COAI)</th>
            <th class="coai-mono">Total In (h)</th>
            <th class="coai-mono">Total Out (h)</th>
            <th class="coai-mono">Net Flow</th>
          </tr>
        </thead>
        <tbody><tr><td colspan="7">Loading…</td></tr></tbody>
        <tfoot><tr id="coai-total-row"><td colspan="7"></td></tr></tfoot>
      </table>
    </div>
  `;

  let currentLoadId = 0;
  const statusEl = document.getElementById('coai-status');
  const btn = document.getElementById('coai-go');

  function fmt(n){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:2}); }

  async function load() {
    const myLoadId = ++currentLoadId;
    btn.disabled = true;
    const w = encodeURIComponent(document.getElementById('coai-wallets').value.trim());
    const h = encodeURIComponent(document.getElementById('coai-hours').value.trim());
    const url = `/api/get-coai?wallets=${w}&hours=${h}&contract=${encodeURIComponent(contract)}`;
    const tbody = document.querySelector("#coai-table tbody");
    const trow = document.getElementById("coai-total-row");
    statusEl.textContent = "Loading…";

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (myLoadId !== currentLoadId) return; // stale
      if (!res.ok) throw new Error("HTTP " + res.status);
      const js = await res.json();

      if (myLoadId !== currentLoadId) return; // stale
      tbody.innerHTML = "";

      let sumBal = 0, sumIn = 0, sumOut = 0, sumNet = 0;

      js.results.forEach((r, i) => {
        sumBal += Number(r.balance);
        sumIn  += Number(r.totalIn);
        sumOut += Number(r.totalOut);
        sumNet += Number(r.netFlow);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${i+1}</td>
          <td>${r.exchange}</td>
          <td class="coai-mono">${r.wallet}</td>
          <td class="coai-mono">${fmt(r.balance)}</td>
          <td class="coai-mono">${fmt(r.totalIn)}</td>
          <td class="coai-mono">${fmt(r.totalOut)}</td>
          <td class="coai-mono ${r.netFlow>=0?'coai-pos':'coai-neg'}">${fmt(r.netFlow)}</td>
        `;
        tbody.appendChild(tr);
      });

      trow.innerHTML = `
        <td></td><td><strong>TOTAL</strong></td><td></td>
        <td class="coai-mono"><strong>${fmt(sumBal)}</strong></td>
        <td class="coai-mono"><strong>${fmt(sumIn)}</strong></td>
        <td class="coai-mono"><strong>${fmt(sumOut)}</strong></td>
        <td class="coai-mono ${sumNet>=0?'coai-pos':'coai-neg'}"><strong>${fmt(sumNet)}</strong></td>
      `;

      const d = new Date(js.updatedAt || Date.now());
      statusEl.textContent = `Updated: ${d.toLocaleTimeString()}`;
    } catch (e) {
      if (myLoadId !== currentLoadId) return;
      tbody.innerHTML = `<tr><td colspan="7">Error: ${String(e)}</td></tr>`;
      trow.innerHTML = `<td colspan="7"></td>`;
      statusEl.textContent = "Error";
    } finally {
      if (myLoadId === currentLoadId) btn.disabled = false;
    }
  }

  btn.addEventListener('click', load);
  load();
}
