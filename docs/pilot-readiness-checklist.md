# Pilot Readiness Checklist (DR-806)

สถานะ: **ยังไม่พร้อม pilot** — รายการที่ต้องมนุษย์ทำยังไม่เสร็จ (ห้ามติ๊กแทน)

## ทำแล้วในโค้ด (ตรวจด้วย automated tests)
- [x] Test matrix T-01…T-30 มีชุดทดสอบครบ
- [x] Kill switches แยก OCR / Jev / auto-classification / export (รับไฟล์ต่อได้)
- [x] Fair queue + daily budget ต่อ office (simulation)
- [x] Log redaction, tombstone/legal hold, stale OCR guard
- [x] Auto-approval ปิดโดย constraint ใน DB

## ต้องทำโดยคน (ยังไม่ทำ)
- [ ] UAT 30 เคส ([`uat-30-cases.md`](uat-30-cases.md)) ผ่านครบกับพนักงานบัญชีและลูกค้า
- [ ] Load test จริงบน staging ด้วย provider quota จริง (เป้า p95 ใน §32 ของแผนแม่บท)
- [ ] ซ้อม outage/restore และ secret rotation ตาม [`runbooks.md`](runbooks.md)
- [ ] ตรวจ private bucket / ไม่มี public URL บน staging จริง
- [ ] Staging sign-off โดย PO + DEV + ACC
- [ ] เซ็นนโยบาย retention กับสำนักงาน pilot
