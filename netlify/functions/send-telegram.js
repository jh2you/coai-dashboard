// 텔레그램 메시지 전송 함수
export async function sendTelegram(message) {
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

    if (!response.ok) {
      const err = await response.text();
      console.error('Telegram API error:', err);
      return false;
    }

    return true;
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
