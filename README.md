# 3dprint

รวมงานของร้าน 3D Print ไว้ใน repo เดียว แยกเป็นโฟลเดอร์ตามแต่ละเว็บ

| โฟลเดอร์ | งาน | รันบน |
|---|---|---|
| [`print3d-queue-gas/`](print3d-queue-gas/) | ระบบหลังร้าน: คิวงานพิมพ์ คำสั่งงาน สต็อก filament การจัดการระบบ | Google Apps Script (Sheet "3DPrint JOB") |
| [`keychain-designer/`](keychain-designer/) | เว็บหน้าร้าน: การทำพวงกุญแจ 3D (จากข้อความ), ทำพวงกุญแจจากรูป (2 สี), พวงกุญแจตัวอักษรมิติ พวงกุญแจชื่อ + โลโก้ (หน้า-หลัง) หัว Griptok ชื่อตัวอักษรมิติ และ Clicker-Namechain ดูตัวอย่าง 3D และโหลด STL | Vercel (project `3ddesign`, https://3ddesign-beta.vercel.app) |

ดีไซน์ สี และโลโก้ที่ทุกเว็บใช้ร่วมกัน อยู่ใน [`BRAND.md`](BRAND.md)

`print3d-queue-gas/` ย้ายมาจาก `nutddell/dev_ot` (branch `claude/intelligent-wozniak-u9rda7`) พร้อมประวัติ commit
วิธี deploy ดูใน [`print3d-queue-gas/README.md`](print3d-queue-gas/README.md)
