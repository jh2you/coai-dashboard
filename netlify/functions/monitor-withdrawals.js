// 5분마다 실행
export const config = {
  schedule: "*/5 * * * *"
};

// COAI 컨트랙트
const COAI_CONTRACT = '0x0a8d6c86e1bce73fe4d0bd531e1a567306836ea5';

// 알려진 거래소 지갑 (Bitget 등)
const EXCHANGE_WALLETS = {
  // Bitget Hot Wallets (일반적으로 알려진 주소들)
  '0x97b9d2102a9a65a26e1ee82d59e42d1b73b68689': 'Bitget',
  '0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23': 'Bitget',
  '0x5bdf85216ec1e38d6458c870992a69e38e03f7ef': 'Bitget',
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

// BSC에서 최근 COAI 전송 가져오기
async function fetchRecentTransfers() {
  const apiKey = process.env.BSCSCAN_API_KEY || '';
  const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${COAI_CONTRACT}&page=1&offset=50&sort=desc&apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && data.result) {
      return data.result;
    }
    return [];
  } catch (e) {
    console.error('BSCScan fetch error:', e);
    return [];
  }
}

// 숫자 포맷
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

async function runMonitor() {
  console.log('Monitor withdrawals triggered at', new Date().toISOString());

  try {
    const transfers = await fetchRecentTransfers();
    if (!transfers.length) {
      console.log('No transfers found');
      return { success: true, withdrawals: 0 };
    }

    const now = Math.floor(Date.now() / 1000);
    const fiveMinutesAgo = now - (5 * 60);

    // 5분 이내 거래소 출금 필터링
    const recentWithdrawals = transfers.filter(tx => {
      const timestamp = parseInt(tx.timeStamp);
      const fromAddress = tx.from.toLowerCase();

      // 5분 이내 + 거래소 지갑에서 출금
      return timestamp >= fiveMinutesAgo && EXCHANGE_WALLETS[fromAddress];
    });

    console.log(`Found ${recentWithdrawals.length} exchange withdrawals in last 5 minutes`);

    // 5건 이상이면 알림
    if (recentWithdrawals.length >= 5) {
      const totalAmount = recentWithdrawals.reduce((sum, tx) => {
        return sum + parseFloat(tx.value) / 1e18;
      }, 0);

      const exchangeCounts = {};
      recentWithdrawals.forEach(tx => {
        const exchange = EXCHANGE_WALLETS[tx.from.toLowerCase()];
        exchangeCounts[exchange] = (exchangeCounts[exchange] || 0) + 1;
      });

      const exchangeList = Object.entries(exchangeCounts)
        .map(([name, count]) => `${name}: ${count}건`)
        .join(', ');

      const message = `<b>🚨 COAI 거래소 출금 급증!</b>

📤 5분 내 <b>${recentWithdrawals.length}건</b> 출금 감지
💰 총 출금량: <b>${formatNumber(totalAmount)} COAI</b>
🏦 출처: ${exchangeList}

⚠️ 대량 출금은 매도 압력 신호일 수 있습니다

🔗 <a href="https://coaidashboard.netlify.app">대시보드 확인</a>`;

      const sent = await sendTelegram(message);
      console.log('Withdrawal alert sent:', sent);

      return { success: true, withdrawals: recentWithdrawals.length, alertSent: sent };
    }

    return { success: true, withdrawals: recentWithdrawals.length };
  } catch (e) {
    console.error('Monitor error:', e);
    return { success: false, error: String(e) };
  }
}

// Scheduled function
export default async function() {
  await runMonitor();
}

// HTTP handler (테스트용)
export async function handler(event) {
  const result = await runMonitor();
  return {
    statusCode: result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  };
}
