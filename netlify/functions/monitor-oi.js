import { getStore } from "@netlify/blobs";

// 5분마다 실행
export const config = {
  schedule: "*/5 * * * *"
};

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

async function runMonitor() {
  console.log('Monitor OI triggered at', new Date().toISOString());

  try {
    // OI 데이터 가져오기
    const currentData = await fetchBinanceOI();
    if (!currentData) {
      console.error('Failed to fetch OI data');
      return;
    }

    const store = getStore("coai-history");
    const now = Date.now();

    // 히스토리 가져오기 및 업데이트
    let history = [];
    try {
      const data = await store.get("history:oi", { type: 'json' });
      if (data) history = data;
    } catch (e) {}

    // 새 데이터 추가
    history.push({
      ...currentData,
      timestamp: now
    });

    // 24시간 이전 데이터 제거
    const MAX_HISTORY_MS = 24 * 60 * 60 * 1000;
    history = history.filter(item => now - item.timestamp < MAX_HISTORY_MS);

    // 최대 288개 유지 (5분 간격 24시간)
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
    const ALERT_COOLDOWN = 5 * 60 * 1000; // 5분

    console.log(`Current trend: ${currentTrend}, Previous: ${prevState.trend}`);

    // 추세 변경 감지
    if (currentTrend !== prevState.trend && (now - prevState.lastAlertTime) > ALERT_COOLDOWN) {
      const trendEmoji = { rising: '📈', falling: '📉', stable: '➡️' };
      const trendText = { rising: '상승세', falling: '하락세', stable: '보합' };

      const alertMessage = `<b>🚨 COAI OI 추세 변경</b>

${trendEmoji[prevState.trend]} ${trendText[prevState.trend]} → ${trendEmoji[currentTrend]} <b>${trendText[currentTrend]}</b>

💰 가격: $${currentData.price.toFixed(4)}
📊 OI: ${formatNumber(currentData.openInterest)}
💹 펀딩비: ${(currentData.fundingRate * 100).toFixed(4)}%

🔗 <a href="https://coaidashboard.netlify.app">대시보드 확인</a>`;

      const sent = await sendTelegram(alertMessage);
      console.log('Alert sent:', sent);

      if (sent) {
        await store.setJSON("alert:state", {
          trend: currentTrend,
          lastAlertTime: now
        });
      }
    }

    console.log('Monitor completed successfully');
    return { success: true, trend: currentTrend };
  } catch (e) {
    console.error('Monitor error:', e);
    return { success: false, error: String(e) };
  }
}

// Scheduled function (자동 실행)
export default async function() {
  await runMonitor();
}

// HTTP handler (수동 테스트용)
export async function handler(event) {
  const result = await runMonitor();
  return {
    statusCode: result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  };
}
