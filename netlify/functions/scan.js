// netlify/functions/scan.js
export async function handler(event, context) {
  try {
    const qs = event.queryStringParameters || {};
    const { address, chain = 'bsc', ...rest } = qs;
    if (!address) {
      return { statusCode: 400, body: JSON.stringify({ error: 'address is required' }) };
    }
    const params = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address,
      sort: 'desc',
      ...rest
    });

    let upstream = '';
    if (chain === 'bsc') {
      params.set('apikey', process.env.BSCSCAN_KEY || '');
      upstream = `https://api.bscscan.com/api?${params.toString()}`;
    } else {
      params.set('apikey', process.env.ETHERSCAN_KEY || '');
      upstream = `https://api.etherscan.io/api?${params.toString()}`;
    }

    const upstreamRes = await fetch(upstream, {
      headers: { 'Cache-Control': 'no-cache' }
    });

    const data = await upstreamRes.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Netlify-CDN-Cache-Control': 'no-store'
      },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
}
