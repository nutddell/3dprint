# Brand / ดีไซน์ร่วมของร้าน

ทุกเว็บใน repo นี้ต้องใช้โลโก้ สี และฟอนต์ชุดเดียวกัน ค่าหลักอยู่ใน `keychain-designer/src/index.css`
(`print3d-queue-gas/` ยังเป็นโทนส้มชุดเดิม ยังไม่ได้ปรับตาม)

## โลโก้
- ไฟล์หลัก: [`shared/brand/logo.png`](shared/brand/logo.png) โลโก้วงกลม "นวมินทร์ 3D Print" (Nawamin3DPrint) พื้นหลังใส
- ชื่อร้านบนหน้าเว็บ: **นวมินทร์ 3D Print**
- เว็บบน Vercel ใช้ไฟล์ย่อขนาดใน `keychain-designer/public/logo.png` (256px) และ `favicon.png` (64px)
- ขนาดโลโก้ใน header: PC 92px, mobile 60px
- `print3d-queue-gas/` ยังใช้โลโก้เดิมจาก Google Drive (ID `1TCIgIjY4dLXY08wZIjGq2cNA7bv19rIx`)
  ถ้าจะเปลี่ยน ให้อัปโหลด `shared/brand/logo.png` ขึ้น Drive แชร์แบบ "ทุกคนที่มีลิงก์"
  แล้วแก้ FILE_ID ใน `<img class="app-logo">` ของทุกหน้า

## สี
อิงจากโลโก้: ม่วงจากวงขอบ เป็นสีหลัก, เหลือง-ส้มจากตัว "3D" เป็นสีเน้น

| Token | สว่าง | มืด | ใช้ทำอะไร |
|---|---|---|---|
| `--brand-900` | `#2b1466` | – | หัวข้อ ตัวอักษรเข้ม |
| `--brand-700` | `#5226c2` | `#c3b0ff` | ตัวอักษรของแท็บที่เลือก |
| `--brand-600` | `#6334e0` | `#8f6bff` | ตัวเลขค่า, ปุ่มหลัก |
| `--brand-500` | `#7a52ef` | `#9d7dff` | ขอบสิ่งที่เลือก, สไลเดอร์ |
| `--brand-100` | `#efeafe` | `#2a2150` | พื้นของสิ่งที่เลือก |
| `--accent-300` / `--accent-500` | `#ffc53d` / `#ff8a1f` | – | "3D" ในชื่อร้าน |
| `--bg` | `#f6f4fc` | `#120e24` | พื้นหลังหน้า (ลาเวนเดอร์อ่อน) |
| `--card` | `#ffffff` | `#1b1633` | การ์ด |
| `--text` | `#241d3b` | `#ece8fb` | ตัวอักษรหลัก |
| `--muted` | `#6b6589` | `#a29bc6` | ตัวอักษรรอง |
| `--border` | `#e3ddf3` | `#2e2754` | เส้นขอบ |
| ปุ่มหลัก | gradient `#8b5cf6` → `#5b21d6` | เหมือนกัน | ปุ่มดาวน์โหลด |

## ชื่อร้านบนหัวเว็บ
ถอดแบบจากโลโก้: "นวมินทร์ **3D** Print" ฟอนต์ Kanit Bold เอียง ตัวขาวขอบม่วง `#4a1fb8` เงา `#2b1466`
ตัว "3D" สีเหลือง-ส้ม และป้าย "Nawamin3DPrint" พื้นม่วงไล่สี ขอบขาว (ดู `.brand-name`, `.bn-pill` ใน `keychain-designer/src/index.css`)

## ฟอนต์และเลย์เอาต์
- `font-family: 'Segoe UI', Sarabun, Tahoma, Arial, sans-serif`
- เนื้อหากว้างสูงสุด 1080px, padding `24px 16px 48px`
- Header จัดกลาง: โลโก้ → ชื่อ (h1 สี `--brand-900`, 24px) → คำอธิบาย → แถบเมนู
- ข้อความบนหน้าเว็บเป็นภาษาไทย
