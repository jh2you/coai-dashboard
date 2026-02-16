// 텔레그램 메시지 전송 함수 (개인 + 그룹)
export async function sendTelegram(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = [
    process.env.TELEGRAM_CHAT_ID,      // 개인 채팅
    process.env.TELEGRAM_GROUP_ID      // 그룹 채팅
  ].filter(Boolean);

  if (!botToken || chatIds.length === 0) {
    console.error('Telegram credentials not configured');
    return false;
  }

  try {
    // 모든 채팅에 전송
    const results = await Promise.all(
      chatIds.map(chatId =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          })
        }).then(r => r.ok).catch(() => false)
      )
    );

    return results.some(r => r); // 하나라도 성공하면 true
  } catch (e) {
    console.error('Telegram send error:', e);
    return false;
  }
}

// HTTP handler for manual testing
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { message } = JSON.parse(event.body || '{}');

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing message' })
      };
    }

    const success = await sendTelegram(message);

    return {
      statusCode: success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(e.message || e) })
    };
  }
}
