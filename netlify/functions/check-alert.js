import { getStore } from "@netlify/blobs";

// 텔레그램 메시지 전송
async function sendTelegram(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('Telegram credentials not configured');
    return false;
  }

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
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { currentData } = JSON.parse(event.body || '{}');

    if (!currentData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing currentData' })
      };
    }

    const store = getStore("coai-history");

    // 히스토리 가져오기
    let history = [];
    try {
      const data = await store.get("history:oi", { type: 'json' });
      if (data) history = data;
    } catch (e) {}

    // 이전 추세 가져오기
    let prevState = { trend: 'stable', lastAlertTime: 0 };
    try {
      const state = await store.get("alert:state", { type: 'json' });
      if (state) prevState = state;
    } catch (e) {}

    // 현재 추세 계산
    const currentTrend = getOITrend(history);
    const now = Date.now();
    const ALERT_COOLDOWN = 5 * 60 * 1000; // 5분 쿨다운

    let alertSent = false;
    let alertMessage = '';

    // 추세 변경 감지
    if (currentTrend !== prevState.trend && (now - prevState.lastAlertTime) > ALERT_COOLDOWN) {
      const trendEmoji = {
        rising: '📈',
        falling: '📉',
        stable: '➡️'
      };

      const trendText = {
        rising: '상승세',
        falling: '하락세',
        stable: '보합'
      };

      alertMessage = `<b>🚨 COAI OI 추세 변경</b>

${trendEmoji[prevState.trend]} ${trendText[prevState.trend]} → ${trendEmoji[currentTrend]} <b>${trendText[currentTrend]}</b>

💰 가격: $${currentData.price?.toFixed(4) || 'N/A'}
📊 OI: ${formatNumber(currentData.openInterest || 0)}
💹 펀딩비: ${((currentData.fundingRate || 0) * 100).toFixed(4)}%

🔗 <a href="https://coaidashboard.netlify.app">대시보드 확인</a>`;

      alertSent = await sendTelegram(alertMessage);

      // 상태 업데이트
      if (alertSent) {
        await store.setJSON("alert:state", {
          trend: currentTrend,
          lastAlertTime: now
        });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentTrend,
        prevTrend: prevState.trend,
        alertSent,
        message: alertMessage ? 'Alert sent' : 'No change'
      })
    };

  } catch (e) {
    console.error('Check alert error:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(e.message || e) })
    };
  }
}
