import { getStore } from "@netlify/blobs";

const MAX_HISTORY_MS = 24 * 60 * 60 * 1000; // 24시간
const MAX_ENTRIES = 288; // 5분 간격으로 24시간 = 288개

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { type, data } = JSON.parse(event.body || '{}');

    if (!type || !data) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing type or data' })
      };
    }

    const store = getStore("coai-history");
    const key = `history:${type}`;

    // 기존 히스토리 가져오기
    let history = [];
    try {
      const existing = await store.get(key, { type: 'json' });
      if (existing) history = existing;
    } catch (e) {
      // 첫 저장시 에러 무시
    }

    const now = Date.now();

    // 새 데이터 추가
    history.push({
      ...data,
      timestamp: now
    });

    // 24시간 이전 데이터 제거
    history = history.filter(item => now - item.timestamp < MAX_HISTORY_MS);

    // 최대 개수 제한
    if (history.length > MAX_ENTRIES) {
      history = history.slice(-MAX_ENTRIES);
    }

    // 저장
    await store.setJSON(key, history);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        count: history.length,
        type
      })
    };

  } catch (e) {
    console.error('Save history error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(e.message || e) })
    };
  }
}
