# 3dprint

รวมงานของร้าน 3D Print ไว้ใน repo เดียว แยกเป็นโฟลเดอร์ตามแต่ละเว็บ

| โฟลเดอร์ | งาน | รันบน |
|---|---|---|
| [`print3d-queue-gas/`](print3d-queue-gas/) | ระบบหลังร้าน: คิวงานพิมพ์ คำสั่งงาน สต็อก filament การจัดการระบบ | Google Apps Script (Sheet "3DPrint JOB") |
| [`keychain-designer/`](keychain-designer/) | การทำพวงกุญแจ 3D: ลูกค้าพิมพ์ข้อความ เลือกฟอนต์/ขนาด/สี ดูตัวอย่าง 3D | Vercel (project `3dprint`) |

ดีไซน์ สี และโลโก้ที่ทุกเว็บใช้ร่วมกัน อยู่ใน [`BRAND.md`](BRAND.md)

`print3d-queue-gas/` ย้ายมาจาก `nutddell/dev_ot` (branch `claude/intelligent-wozniak-u9rda7`) พร้อมประวัติ commit
วิธี deploy ดูใน [`print3d-queue-gas/README.md`](print3d-queue-gas/README.md)
