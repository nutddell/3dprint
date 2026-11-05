# การทำพวงกุญแจ 3D (keychain-designer)

เว็บให้ลูกค้าพิมพ์ข้อความ เลือกฟอนต์ ขนาด และสี แล้วดูพวงกุญแจ 3D ได้ทันที
ทุกอย่างคำนวณในเบราว์เซอร์ ไม่มีเซิร์ฟเวอร์ (deploy บน Vercel เป็นเว็บ static)

```bash
npm install
npm run dev      # เปิดที่ http://localhost:5173
npm run build    # ได้ไฟล์ใน dist/
```

## โครงสร้าง
- `src/geometry.ts` – จัดตัวอักษรด้วย HarfBuzz (วางสระ/วรรณยุกต์ไทยถูกตำแหน่ง) → รวมเส้นขอบด้วย Clipper
  → ขยายเป็นแผ่นฐาน (ระยะ 4 mm) + ห่วงด้านซ้าย → extrude ด้วย Three.js (ฐาน 3 mm + ตัวอักษร 2 mm)
- `src/Preview.tsx` – ฉาก 3D (ลากหมุน / เลื่อนซูม)
- `src/fonts.ts` – รายการฟอนต์ ไฟล์อยู่ใน `public/fonts/`
- `src/App.tsx`, `src/index.css` – หน้าเว็บ สีตาม `BRAND.md` ที่ root ของ repo

"ขนาดความสูงตัวอักษร" วัดจากความสูงตัว H ของฟอนต์นั้น

## ฟอนต์
ไทย: Sarabun, Prompt, Kanit (ทางการ) · Mali, Sriracha (ไม่เป็นทางการ)
อังกฤษ: Poppins, Bebas Neue (ทางการ) · Pacifico, Lobster, Permanent Marker (ไม่เป็นทางการ)
ฟอนต์อังกฤษจะใช้ Kanit กับตัวอักษรไทย ทุกฟอนต์ใช้เชิงพาณิชย์ได้ (SIL OFL 1.1 / Apache 2.0, ดู `public/fonts/`)
