const line = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const { buildDeepLink } = require('../../lib/deepLinks');

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new line.Client(lineConfig);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `คุณคือ Somchai TripMate ผู้ช่วยไลฟ์สไตล์บน LINE
แยกความต้องการของผู้ใช้ออกมาเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON
รูปแบบที่ต้องตอบกลับเป๊ะ ๆ:
{"category":"hotel|flight|tour|restaurant|fitness|event","destination":"ชื่อสถานที่หรือย่าน","checkin":"YYYY-MM-DD หรือค่าว่าง","checkout":"YYYY-MM-DD หรือค่าว่าง","guests":จำนวนตัวเลข,"budget":ตัวเลขหรือ null,"reply_text":"ข้อความสั้น ๆ ที่จะตอบผู้ใช้ก่อนโชว์ตัวเลือก"}`;

exports.handler = async (event) => {
  const signature = event.headers['x-line-signature'] || event.headers['X-Line-Signature'];

  if (!signature || !line.validateSignature(event.body, lineConfig.channelSecret, signature)) {
    return { statusCode: 401, body: 'invalid signature' };
  }

  const body = JSON.parse(event.body);
  await Promise.all((body.events || []).map(handleEvent));

  return { statusCode: 200, body: 'OK' };
};

async function handleEvent(lineEvent) {
  if (lineEvent.type !== 'message' || lineEvent.message.type !== 'text') {
    return null;
  }

  const userText = lineEvent.message.text;
  let intent;

  try {
    const intentResp = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userText }],
    });
    intent = JSON.parse(intentResp.content[0].text);
  } catch (err) {
    console.error('Intent parsing failed', err);
    return lineClient.replyMessage(lineEvent.replyToken, {
      type: 'text',
      text: 'ขอโทษครับ ช่วยพิมพ์รายละเอียดอีกครั้งได้ไหมครับ เช่น ปลายทาง วันที่ จำนวนคน',
    });
  }

  const bookingUrl = buildDeepLink(intent);
  const flexMessage = buildFlexBubble(intent, bookingUrl);

  const messages = [];
  if (intent.reply_text) {
    messages.push({ type: 'text', text: intent.reply_text });
  }
  messages.push(flexMessage);

  return lineClient.replyMessage(lineEvent.replyToken, messages);
}

function buildFlexBubble(intent, url) {
  return {
    type: 'flex',
    altText: 'ตัวเลือกที่แนะนำ',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: intent.destination || 'ตัวเลือกที่แนะนำ',
            weight: 'bold',
            size: 'md',
            wrap: true,
          },
          {
            type: 'text',
            text: intent.budget ? `งบประมาณโดยประมาณ ${intent.budget} บาท` : 'ดูรายละเอียดและราคาที่หน้าเว็บ',
            size: 'sm',
            color: '#5B5B5B',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#06C755',
            action: { type: 'uri', label: 'ดูตัวเลือก', uri: url },
          },
        ],
      },
    },
  };
}
