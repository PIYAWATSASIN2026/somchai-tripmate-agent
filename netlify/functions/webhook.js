const line = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const { getStore } = require('@netlify/blobs');
const { buildDeepLink } = require('../../lib/deepLinks');

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new line.Client(lineConfig);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const READY_MARKER = '[READY_FOR_AGENT]';
const CONVO_TTL_MS = 30 * 60 * 1000; // reset conversation after 30 min of silence
const MAX_HISTORY_MESSAGES = 16; // keep context small / cheap

const CATEGORY_LABELS = {
  th: {
    hotel: 'ที่พัก',
    flight: 'ตั๋วเครื่องบิน',
    tour: 'ทัวร์ / กิจกรรม',
    restaurant: 'ร้านอาหาร',
    fitness: 'ฟิตเนส',
    event: 'อีเวนต์',
  },
  en: {
    hotel: 'Hotel',
    flight: 'Flight',
    tour: 'Tour / Activity',
    restaurant: 'Restaurant',
    fitness: 'Fitness',
    event: 'Event',
  },
};

const SYSTEM_PROMPT = `คุณคือ "AI Front-Desk Assistant" ผู้ช่วยต้อนรับของ Somchai TripMate มีหน้าที่พูดคุยกับผู้ใช้เพื่อรวบรวมความต้องการด้านการเดินทาง/ไลฟ์สไตล์ให้ครบถ้วน ก่อนส่งต่อให้ระบบค้นหาข้อมูลด้านหลัง (Agent) ทำงานต่อ

บุคลิก: คุณคือแอดมินเพศชาย ใช้น้ำเสียงและคำลงท้ายแบบผู้ชายเสมอ (เช่น "ครับ", "ผม") ห้ามใช้คำลงท้ายเพศหญิงเด็ดขาด

กติกาการสนทนา:
1. ห้ามสรุปหรือส่งข้อมูลไปประมวลผลทันทีตั้งแต่ข้อความแรก ให้พูดคุยไปทีละประเด็นอย่างเป็นกันเอง ไม่ถามรวดเดียวหลายเรื่องจนผู้ใช้อึดอัด
2. ต้องรวบรวมข้อมูลให้ครบ 3 อย่างก่อนสรุปงาน:
   a) จุดประสงค์หลัก — ผู้ใช้ต้องการหาอะไร/ทำอะไร (ที่พัก, ตั๋วเครื่องบิน, ทัวร์, ร้านอาหาร, ฟิตเนส, อีเวนต์ หรือหลายอย่างรวมกัน)
   b) ข้อมูลเฉพาะเจาะจง — ปลายทาง, งบประมาณ, ช่วงเวลา/วันที่, จำนวนคน, เงื่อนไขสำคัญอื่นๆ
   c) รูปแบบผลลัพธ์ที่ต้องการ — เช่น สรุปสั้นๆ, ตารางเปรียบเทียบ, หรือลิสต์รายชื่อ (ถ้าผู้ใช้ไม่ระบุ ให้ถือว่าต้องการสรุปสั้นพร้อมลิงก์ ไม่ต้องถามซ้ำ)
3. ถ้าข้อมูลยังไม่ครบ ให้ถามคำถามที่เจาะจง 1-2 ข้อในการตอบแต่ละครั้งเท่านั้น และตอบเป็นข้อความสนทนาธรรมดา ห้ามใส่ JSON หรือคำว่า ${READY_MARKER} ปนอยู่ในคำตอบระหว่างที่ข้อมูลยังไม่ครบ
4. เมื่อข้อมูลครบถ้วนแล้ว ให้ตอบครั้งเดียวด้วยข้อความที่ขึ้นต้นด้วย ${READY_MARKER} เป็นตัวอักษรตัวแรกสุดของข้อความเป๊ะๆ ตามด้วย JSON ล้วนๆ เท่านั้น ห้ามมีข้อความทักทาย คำขอบคุณ หรือคำนำใดๆ อยู่ก่อนหน้า ${READY_MARKER} เด็ดขาด (ห้ามมีข้อความอื่นนอกเหนือจาก JSON ปนอยู่เลย ห้ามใช้ markdown code fence) ตามรูปแบบนี้เป๊ะๆ:
${READY_MARKER}
{"destination":"ชื่อสถานที่หรือย่าน","checkin":"YYYY-MM-DD หรือค่าว่าง","checkout":"YYYY-MM-DD หรือค่าว่าง","guests":จำนวนตัวเลข,"budget":ตัวเลขหรือ null,"categories":["เลือกจาก hotel|flight|tour|restaurant|fitness|event อย่างน้อย 1 หมวด"],"output_format":"summary|comparison|list","language":"th หรือ en","reply_text":"ข้อความแผนการเดินทางแบบเจาะจงเป็นรายวัน (ดูกติกาข้อ 7)"}
5. เมื่อผู้ใช้ต้องการวางแผนการเดินทาง (เช่น จะไปเที่ยว) ให้ categories ครอบคลุมโซลูชันแบบครบวงจรในคราวเดียว (ที่พัก + ตั๋วเครื่องบิน + ทัวร์/กิจกรรม ตามความเกี่ยวข้อง) ไม่ใช่ตอบแค่หมวดเดียว เว้นแต่ผู้ใช้ระบุชัดเจนว่าต้องการแค่อย่างเดียว
6. ถ้าผู้ใช้พิมพ์เป็นภาษาอังกฤษ ให้ตอบเป็นภาษาอังกฤษทั้งหมด (รวมถึง reply_text และ language ใน JSON ตอนสรุป ให้ตั้งเป็น "en")
7. reply_text ต้องเป็น "แผนการเดินทางที่ปรึกษาให้จริง" ไม่ใช่ข้อความทั่วไปแบบ "กำลังหาตัวเลือกให้นะครับ" ต้องมีสาระดังนี้:
   - แบ่งเป็นรายวัน (Day 1 / Day 2 / Day 3 ...) ตามจำนวนวันที่ผู้ใช้ระบุ แต่ละวันแบ่งเป็นช่วงเช้า/บ่าย/เย็น
   - อ้างอิงสถานที่ กิจกรรม หรือร้านที่มีอยู่จริงในจุดหมายปลายทางนั้น (เช่น วัด ตลาด คาเฟ่ จุดชมวิว ถนนดนตรี) ให้ตรงกับความสนใจที่ผู้ใช้บอก (เช่น ไหว้พระ ฟังดนตรี กินกาแฟ) ห้ามเขียนลอยๆ แบบไม่เจาะจง
   - คำนึงถึงงบประมาณที่ผู้ใช้ให้ไว้ด้วย (เช่น เลือกกิจกรรม/ร้านที่ราคาเหมาะสมกับงบ)
   - ปิดท้ายสั้นๆ ว่าเดี๋ยวจะโชว์ตัวเลือกที่พัก/ตั๋ว/ทัวร์ให้เลือกจองด้านล่าง
   - ความยาวพอเหมาะ (ประมาณ 150-300 คำ) ใช้บรรทัดใหม่แบ่งหัวข้อให้อ่านง่ายใน LINE ไม่ใช่ย่อหน้าเดียวยาวๆ`;

exports.handler = async (event) => {
  const signature = event.headers['x-line-signature'] || event.headers['X-Line-Signature'];

  if (!signature || !line.validateSignature(event.body, lineConfig.channelSecret, signature)) {
    return { statusCode: 401, body: 'invalid signature' };
  }

  const body = JSON.parse(event.body);
  await Promise.all((body.events || []).map(handleEvent));

  return { statusCode: 200, body: 'OK' };
};

function getConvoStore() {
  // Zero-config getStore('name') should work automatically inside a deployed
  // Netlify Function. If that auto-detection isn't available in this
  // environment, fall back to explicit site ID + token (set as
  // BLOBS_SITE_ID / BLOBS_TOKEN environment variables in Netlify).
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    return getStore({
      name: 'conversations',
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN,
    });
  }
  return getStore('conversations');
}

async function loadHistory(userId) {
  try {
    const store = getConvoStore();
    const record = await store.get(userId, { type: 'json' });
    if (!record || !record.updatedAt || Date.now() - record.updatedAt > CONVO_TTL_MS) {
      return [];
    }
    return record.messages || [];
  } catch (err) {
    // Session memory is a nice-to-have, not a hard dependency — never let a
    // Blobs/config problem break the conversation itself.
    console.error('loadHistory: Blobs unavailable, continuing without memory:', err.message);
    return [];
  }
}

async function saveHistory(userId, messages) {
  try {
    const store = getConvoStore();
    const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
    await store.setJSON(userId, { updatedAt: Date.now(), messages: trimmed });
  } catch (err) {
    console.error('saveHistory: Blobs unavailable, continuing without memory:', err.message);
  }
}

async function clearHistory(userId) {
  try {
    const store = getConvoStore();
    await store.delete(userId);
  } catch (err) {
    console.error('clearHistory: Blobs unavailable:', err.message);
  }
}

async function handleEvent(lineEvent) {
  if (lineEvent.type !== 'message' || lineEvent.message.type !== 'text') {
    return null;
  }

  const userId = lineEvent.source && lineEvent.source.userId;
  const userText = lineEvent.message.text;

  try {
    const history = userId ? await loadHistory(userId) : [];
    const messages = [...history, { role: 'user', content: userText }];

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 3000, // itinerary-style reply_text needs more room than a short confirmation
      thinking: { type: 'disabled' }, // extended thinking was silently eating the token budget, leaving no room for the actual reply
      system: SYSTEM_PROMPT,
      messages,
    });

    const textBlock = resp.content.find((block) => block.type === 'text');
    if (!textBlock) {
      throw new Error('Claude response had no text block: ' + JSON.stringify(resp.content));
    }
    const replyRaw = textBlock.text.trim();

    const markerIndex = replyRaw.indexOf(READY_MARKER);
    if (markerIndex !== -1) {
      const jsonPart = replyRaw.slice(markerIndex + READY_MARKER.length).trim();
      const intent = JSON.parse(stripCodeFence(jsonPart));

      if (userId) await clearHistory(userId);

      const outMessages = [];
      if (intent.reply_text) {
        outMessages.push({ type: 'text', text: intent.reply_text });
      }
      outMessages.push(buildFlexCarousel(intent));

      return lineClient.replyMessage(lineEvent.replyToken, outMessages);
    }

    // Still gathering requirements — plain conversational reply, remember the turn.
    if (userId) {
      await saveHistory(userId, [
        ...messages,
        { role: 'assistant', content: replyRaw },
      ]);
    }

    return lineClient.replyMessage(lineEvent.replyToken, { type: 'text', text: replyRaw });
  } catch (err) {
    console.error('Front-desk conversation failed', err);
    return lineClient.replyMessage(lineEvent.replyToken, {
      type: 'text',
      text: 'ขอโทษครับ ระบบมีปัญหาชั่วคราว ช่วยพิมพ์อีกครั้งได้ไหมครับ',
    });
  }
}

function stripCodeFence(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function buildFlexCarousel(intent) {
  const lang = intent.language === 'en' ? 'en' : 'th';
  const labels = CATEGORY_LABELS[lang];
  const categories = Array.isArray(intent.categories) && intent.categories.length
    ? intent.categories
    : [intent.category].filter(Boolean);

  const bubbles = categories
    .filter((c) => labels[c])
    .slice(0, 10) // LINE carousel limit
    .map((category) => buildFlexBubble(intent, category, labels[category], lang));

  return {
    type: 'flex',
    altText: lang === 'en' ? 'Recommended options' : 'ตัวเลือกที่แนะนำ',
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

function buildFlexBubble(intent, category, label, lang) {
  const url = buildDeepLink({ ...intent, category });
  const budgetText = intent.budget
    ? (lang === 'en' ? `Est. budget ${intent.budget} THB` : `งบประมาณโดยประมาณ ${intent.budget} บาท`)
    : (lang === 'en' ? 'See details and pricing on the site' : 'ดูรายละเอียดและราคาที่หน้าเว็บ');
  const buttonLabel = lang === 'en' ? 'View options' : 'ดูตัวเลือก';

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'text',
          text: label,
          size: 'xs',
          color: '#06C755',
          weight: 'bold',
        },
        {
          type: 'text',
          text: intent.destination || label,
          weight: 'bold',
          size: 'md',
          wrap: true,
        },
        {
          type: 'text',
          text: budgetText,
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
          action: { type: 'uri', label: buttonLabel, uri: url },
        },
      ],
    },
  };
}
