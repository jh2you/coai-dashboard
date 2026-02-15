// OI 모니터링 (HTTP로 호출)
// 외부 cron 서비스로 5분마다 호출 필요

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

// 숫자 포맷
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

// HTTP handler
export async function handler(event) {
  console.log('Monitor OI triggered at', new Date().toISOString());

  try {
    // OI 데이터 가져오기
    const currentData = await fetchBinanceOI();
    if (!currentData) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to fetch OI data' })
      };
    }

    // 펀딩비 임계값 체크 (극단적 펀딩비 알림)
    const fundingRate = currentData.fundingRate;
    const FUNDING_THRESHOLD = 0.001; // 0.1%

    let alertSent = false;
    if (Math.abs(fundingRate) > FUNDING_THRESHOLD) {
      const direction = fundingRate > 0 ? '롱 과열 🔴' : '숏 과열 🟢';
      const message = `<b>⚠️ COAI 펀딩비 경고</b>

${direction}
💹 펀딩비: <b>${(fundingRate * 100).toFixed(4)}%</b>
💰 가격: $${currentData.price.toFixed(4)}
📊 OI: ${formatNumber(currentData.openInterest)}

🔗 <a href="https://coaidashboard.netlify.app">대시보드 확인</a>`;

      alertSent = await sendTelegram(message);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: currentData,
        fundingAlert: Math.abs(fundingRate) > FUNDING_THRESHOLD,
        alertSent
      })
    };
  } catch (e) {
    console.error('Monitor error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(e.message || e) })
    };
  }
}
