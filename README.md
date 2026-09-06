# Somchai TripMate — Agent จริง (ไม่ใช่ prototype)

โค้ดชุดนี้เป็น backend จริงที่ใช้งานได้: รับข้อความจาก LINE → ส่งให้ Claude API
แยกความต้องการ → สร้าง deep link ไปยัง Agoda / Traveloka / Klook / Wongnai /
ClassPass / Zipevent (ไม่ต้องมี affiliate ID ก็ใช้ได้ทันที) → ตอบกลับเป็น Flex
Message ใน LINE

สิ่งที่ยังต้องทำเอง (บัญชีเป็นของคุณ ผมสมัครแทนไม่ได้):

## 1. สร้าง LINE Official Account + Messaging API channel (ฟรี)
1. ไปที่ https://developers.line.biz/console/ แล้วล็อกอินด้วยบัญชี LINE
2. สร้าง Provider ใหม่ (ชื่ออะไรก็ได้ เช่น "Somchai TripMate")
3. สร้าง Channel ประเภท "Messaging API"
4. ในหน้า channel: คัดลอก **Channel secret** (แท็บ Basic settings) และออก
   **Channel access token** (แท็บ Messaging API → Issue)
5. ปิด "Auto-reply messages" และ "Greeting messages" ในแท็บ Messaging API
   เพื่อไม่ให้ชนกับบอทของเรา

## 2. ขอ Anthropic API key (ฟรีสมัคร มีเครดิตทดลองให้)
1. ไปที่ https://console.anthropic.com/
2. สร้าง API key ใหม่ เก็บไว้ (จะใช้แค่ครั้งเดียวตอนตั้งค่า)

## 3. Deploy ขึ้น Netlify
1. อัปโหลดโฟลเดอร์นี้ทั้งหมดขึ้น GitHub repo ใหม่ (หรือ deploy ตรงจากเครื่องก็ได้)
2. ที่ https://app.netlify.com สร้างไซต์ใหม่จาก repo นี้
3. ไปที่ Site settings → Environment variables ใส่ 3 ค่านี้:
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
   - `ANTHROPIC_API_KEY`
4. Deploy site — Netlify จะได้ URL ของ function ที่
   `https://<your-site>.netlify.app/.netlify/functions/webhook`

## 4. ผูก Webhook กับ LINE
1. กลับไปที่ LINE Developers Console → แท็บ Messaging API
2. ใส่ Webhook URL เป็น URL จากขั้นตอนที่ 3 แล้วกด "Verify" ให้ขึ้นสถานะสำเร็จ
3. เปิดสวิตช์ "Use webhook" เป็น ON

## 5. ทดสอบ
สแกน QR code ของ Official Account (อยู่ในหน้า Basic settings) แล้วพิมพ์คุยได้เลย
เช่น "อยากไปเชียงใหม่ 3 คืน งบ 15,000 บาท"

---

## ข้อจำกัดที่ควรรู้ก่อนใช้จริง

- **restaurant / fitness / event ยังเป็นแค่ deep link ค้นหา** เพราะ Wongnai,
  ClassPass, Zipevent ไม่มี public API ให้ดึงราคา/ที่ว่างแบบเรียลไทม์ — ผู้ใช้
  จะถูกพาไปหน้าค้นหาที่กรอกคำค้นไว้แล้ว ไม่ใช่หน้าผลลัพธ์ที่กรองครบ 100%
- **hotel / flight / tour** ใช้ query parameter ของแต่ละเว็บโดยตรง ยังไม่มี
  affiliate ID ติดไปด้วย (ดูคอมเมนต์ในไฟล์ `lib/deepLinks.js` สำหรับจุดที่ต้อง
  เพิ่ม ID หลังสมัคร affiliate)
- โค้ดนี้ตอบทีละ 1 ตัวเลือกต่อข้อความ (ไม่ใช่ carousel หลายใบเหมือน
  prototype) เพื่อให้ครบ flow ง่ายที่สุดก่อน ค่อยขยายเป็น carousel/
  หลายแหล่งข้อมูลได้ในเวอร์ชันถัดไป
- ยังไม่มีการเก็บ session/ประวัติการคุย — แต่ละข้อความถูกตีความแยกกัน
  ขั้นต่อไปควรเพิ่มการเก็บ context ต่อผู้ใช้ (เช่น ผ่าน Netlify Blobs หรือฐาน
  ข้อมูลภายนอก) เพื่อให้คุยต่อเนื่องหลายข้อความได้เหมือนใน prototype
