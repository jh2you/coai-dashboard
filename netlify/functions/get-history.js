import { getStore } from "@netlify/blobs";

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const type = event.queryStringParameters?.type || 'oi';
    const limit = parseInt(event.queryStringParameters?.limit || '100');

    const store = getStore("coai-history");
    const key = `history:${type}`;

    let history = [];
    try {
      const data = await store.get(key, { type: 'json' });
      if (data) history = data;
    } catch (e) {
      // 데이터 없음
    }

    // 최근 N개만 반환
    const result = history.slice(-limit);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        type,
        count: result.length,
        data: result
      })
    };

  } catch (e) {
    console.error('Get history error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(e.message || e) })
    };
  }
}
