# Brand / ดีไซน์ร่วมของร้าน

ทุกเว็บใน repo นี้ต้องใช้โลโก้ สี และฟอนต์ชุดเดียวกัน ค่าหลักมาจาก `print3d-queue-gas/index.html`

## โลโก้
- ไฟล์หลัก: [`shared/brand/logo.png`](shared/brand/logo.png) โลโก้วงกลม "นวมินทร์ 3D Print" (Nawamin3DPrint) พื้นหลังใส
- ชื่อร้านบนหน้าเว็บ: **นวมินทร์ 3D Print**
- เว็บบน Vercel ใช้ไฟล์ย่อขนาดใน `keychain-designer/public/logo.png` (256px) และ `favicon.png` (64px)
- ความสูงโลโก้ใน header: PC 64px, mobile 44px
- `print3d-queue-gas/` ยังใช้โลโก้เดิมจาก Google Drive (ID `1TCIgIjY4dLXY08wZIjGq2cNA7bv19rIx`)
  ถ้าจะเปลี่ยน ให้อัปโหลด `shared/brand/logo.png` ขึ้น Drive แชร์แบบ "ทุกคนที่มีลิงก์"
  แล้วแก้ FILE_ID ใน `<img class="app-logo">` ของทุกหน้า

## สี
| Token | ค่า | ใช้ทำอะไร |
|---|---|---|
| `--brand-900` | `#3a1d06` | หัวข้อ ตัวอักษรเข้ม |
| `--brand-700` | `#9a4a0b` | hover / ตัวอักษรเน้น |
| `--brand-600` | `#c75f0e` | ปุ่มหลัก |
| `--brand-500` | `#e8731a` | สีส้มหลักของแบรนด์ |
| `--brand-100` | `#fdebdc` | พื้นอ่อนของสิ่งที่เลือกอยู่ |
| `--bg` | `#faf7f4` | พื้นหลังหน้า (ครีม) |
| `--text` | `#2a2420` | ตัวอักษรหลัก |
| `--muted` | `#776a60` | ตัวอักษรรอง |
| `--border` | `#e8ddd3` | เส้นขอบ |
| `--white` | `#ffffff` | การ์ด |
| `--success` | `#1f8a4c` | สำเร็จ |
| `--danger` | `#c0392b` | ผิดพลาด / ลบ |
| `--printing` / `-50` | `#2563eb` / `#eef4ff` | สถานะกำลังพิมพ์ |
| `--ready` / `-50` | `#16a34a` / `#ecfdf3` | สถานะพร้อม |
| `--design` / `-50` | `#eab308` / `#fefce8` | สถานะออกแบบ |

## ฟอนต์และเลย์เอาต์
- `font-family: 'Segoe UI', Sarabun, Tahoma, Arial, sans-serif`
- เนื้อหากว้างสูงสุด 1080px, padding `24px 16px 48px`
- Header จัดกลาง: โลโก้ → ชื่อ (h1 สี `--brand-900`, 24px) → คำอธิบาย → แถบเมนู
- ข้อความบนหน้าเว็บเป็นภาษาไทย
