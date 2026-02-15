export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'OpenAI API key not configured' })
    };
  }

  try {
    const { marketData } = JSON.parse(event.body || '{}');

    if (!marketData) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing market data' })
      };
    }

    const systemPrompt = `당신은 암호화폐 선물 시장 분석 전문가입니다. COAI 토큰의 실시간 데이터를 분석하여 트레이더에게 유용한 인사이트를 제공합니다.

분석 시 다음 원칙을 따르세요:
1. 데이터 기반의 객관적 분석
2. 추세 강화/반전 신호 명확히 언급
3. 펀딩비와 OI의 관계 해석
4. 단기 전망 제시 (확신도와 함께)
5. 간결하고 핵심적인 한국어 응답 (3-4문장)

펀딩비 해석:
- 음수(-): 숏 포지션이 많음, 하락 베팅 과열
- 양수(+): 롱 포지션이 많음, 상승 베팅 과열
- 극단적 펀딩비: 반대 방향 반전 가능성

OI + 가격 해석:
- 가격↑ + OI↑: 강한 상승 추세 (신규 롱 진입)
- 가격↓ + OI↑: 강한 하락 추세 (신규 숏 진입)
- 가격↑ + OI↓: 약한 상승 (숏 청산)
- 가격↓ + OI↓: 약한 하락 (롱 청산)`;

    // 10분 히스토리 포맷팅
    let historyStr = '';
    if (marketData.history && marketData.history.length > 0) {
      historyStr = '\n\n최근 10분 데이터 (1분 간격):\n시간 | OI | 가격 | 펀딩비\n';
      historyStr += marketData.history.map(h =>
        `${h.time} | ${formatNumber(h.oi)} | $${h.price.toFixed(4)} | ${(h.funding * 100).toFixed(4)}%`
      ).join('\n');
    }

    const userPrompt = `현재 COAI 시장 데이터:

가격: $${marketData.price?.toFixed(4) || 'N/A'}
OI (미체결약정): ${marketData.oi ? formatNumber(marketData.oi) : 'N/A'}
바이낸스 펀딩비: ${marketData.fundingRate ? (marketData.fundingRate * 100).toFixed(4) + '%' : 'N/A'}
OI 변화율 (10분): ${marketData.oiChange ? (marketData.oiChange * 100).toFixed(2) + '%' : 'N/A'}
가격 변화율 (10분): ${marketData.priceChange ? (marketData.priceChange * 100).toFixed(2) + '%' : 'N/A'}
OI 추세: ${marketData.oiTrend || 'N/A'}${historyStr}

이 데이터를 바탕으로 현재 시장 상황을 분석해주세요.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OpenAI API error', details: errorData })
      };
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || 'No analysis available';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        analysis,
        timestamp: Date.now(),
        model: 'gpt-4o'
      })
    };

  } catch (e) {
    console.error('AI analysis error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(e.message || e) })
    };
  }
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}
