# Pilot Playbook (DR-901, DR-902, DR-903, DR-906)

## ก่อนเริ่ม
- ผ่าน [`pilot-readiness-checklist.md`](pilot-readiness-checklist.md) ครบ (UAT 30 เคส, load test, restore drill, staging sign-off)
- เปิดเฉพาะ manual + assist; `auto_approval_enabled` ต้องเป็น false; auto-classification ปิดไว้จนผ่าน gate

## Stage 1 — 1 สำนักงาน / 2 บริษัท (DR-901)
1. ตรวจ **ทุกเคสแรก** ด้วยคน
2. เก็บ **baseline** คู่เทียบ: เวลาจัดชุดแบบเดิมของงานชุดเดียวกัน บันทึกด้วย `recordPilotEvent` (`mode: baseline`) และเวลา assisted (`mode: assisted`)
3. บันทึก onboarding time และงาน support ต่อบริษัท
4. ขั้นต่ำ 7 วันทำงาน และต้องรวมรอบบัญชีที่จบจริง

## Stage 2 — 2 สำนักงาน / 6 บริษัท (DR-902)
- ขยายได้เมื่อ `evaluatePilotRolloutStage` ผ่าน (ไม่มี blocking defects และ S8 readiness ผ่าน)

## สุ่มตรวจคุณภาพ (DR-903)
- ใช้ `buildReviewSample` ดึง 3 กลุ่ม: ที่คนรับ, ที่คนแก้, ที่ AI บอกไม่รู้
- ผู้ตรวจอ่านจากภาพจริง ไม่ใช้ OCR text เป็น ground truth; ACC ตรวจซ้ำ ≥ 20% รวมเคสกำกวม
- บันทึกผลด้วย `recordReviewSampleResult`

## ทดลอง auto-classification (DR-904)
- เปิดเฉพาะหมวดที่ `evaluateAutoClassificationGate` ผ่าน (≥ 300 decisions รวม และ Wilson lower bound ≥ 0.95 ต่อหมวด) และสำนักงานเลือกเปิดเอง
- field สำคัญและ package ยังต้องคนอนุมัติเสมอ

## Willingness-to-pay (DR-906)
ถามผู้ใช้จริง (ACC / เจ้าของสำนักงาน / ลูกค้า) เรื่องโมเดลราคา (subscription + page allowance, client seats, ต่อหน้า) และ price band บันทึกด้วย `recordWtpResponse` ไม่เก็บข้อความอิสระที่อาจมีข้อมูลส่วนบุคคล

## สิ้นสุด
กรอก [`pilot-report.md`](pilot-report.md) แล้วตัดสินใจด้วย `evaluatePilotDecision`; ถ้ายังไม่ครบเงื่อนไข คง pilot ต่อ
