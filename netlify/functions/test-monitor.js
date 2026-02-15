import { getStore } from "@netlify/blobs";

// 텔레그램 메시지 전송
async function sendTelegram(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return false;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      }
    );
    return response.ok;
  } catch (e) {
    console.error('Telegram send error:', e);
    return false;
  }
}

// Binance OI 가져오기
async function fetchBinanceOI() {
  try {
    const [oiRes, premiumRes] = await Promise.all([
      fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=COAIUSDT'),
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=COAIUSDT'),
    ]);

    const oiData = await oiRes.json();
    const premiumData = await premiumRes.json();

    return {
      openInterest: parseFloat(oiData.openInterest) || 0,
      price: parseFloat(premiumData.markPrice) || 0,
      fundingRate: parseFloat(premiumData.lastFundingRate) || 0,
    };
  } catch (e) {
    console.error('Binance fetch error:', e);
    return null;
  }
}

// OI 추세 계산
function getOITrend(history) {
  if (history.length < 5) return 'stable';

  const recent = history.slice(-5);
  const avgRecent = recent.reduce((sum, p) => sum + p.openInterest, 0) / recent.length;
  const older = history.slice(-10, -5);

  if (older.length === 0) return 'stable';

  const avgOlder = older.reduce((sum, p) => sum + p.openInterest, 0) / older.length;
  const change = (avgRecent - avgOlder) / avgOlder;

  if (change > 0.02) return 'rising';
  if (change < -0.02) return 'falling';
  return 'stable';
}

// 숫자 포맷
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

export async function handler(event) {
  console.log('Test Monitor triggered at', new Date().toISOString());

  try {
    // OI 데이터 가져오기
    const currentData = await fetchBinanceOI();
    if (!currentData) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch OI data' })
      };
    }

    const store = getStore("coai-history");
    const now = Date.now();

    // 히스토리 가져오기
    let history = [];
    try {
      const data = await store.get("history:oi", { type: 'json' });
      if (data) history = data;
    } catch (e) {
      console.log('No existing history');
    }

    // 새 데이터 추가
    history.push({
      ...currentData,
      timestamp: now
    });

    // 24시간 이전 데이터 제거
    const MAX_HISTORY_MS = 24 * 60 * 60 * 1000;
    history = history.filter(item => now - item.timestamp < MAX_HISTORY_MS);

    // 최대 288개 유지
    if (history.length > 288) {
      history = history.slice(-288);
    }

    // 히스토리 저장
    await store.setJSON("history:oi", history);

    // 이전 상태 가져오기
    let prevState = { trend: 'stable', lastAlertTime: 0 };
    try {
      const state = await store.get("alert:state", { type: 'json' });
      if (state) prevState = state;
    } catch (e) {}

    // 현재 추세 계산
    const currentTrend = getOITrend(history);

    // 결과 반환
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        currentData,
        historyCount: history.length,
        currentTrend,
        prevTrend: prevState.trend,
        trendChanged: currentTrend !== prevState.trend
      })
    };

  } catch (e) {
    console.error('Test monitor error:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(e.message || e) })
    };
  }
}
