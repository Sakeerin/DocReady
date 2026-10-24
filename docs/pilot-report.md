# Pilot Report (DR-905)

> **สถานะ: ยังไม่มีข้อมูล** — ทุกช่องเป็น `TBD` และต้องกรอกจากข้อมูลจริงเท่านั้น ห้ามใช้ตัวเลขสมมติ
> หน้า `/reports/pilot` และ `computePilotMetrics` จะตอบ `insufficient_sample` เมื่อตัวอย่างต่อโหมดน้อยกว่า 100 เอกสาร

## 1. ข้อมูลทั่วไป
| รายการ | ค่า |
|---|---|
| ช่วงเวลา pilot | TBD |
| จำนวนวันทำงาน (ต้อง ≥ 7) | TBD |
| จบรอบบัญชีจริงหรือไม่ | TBD |
| Stage ปัจจุบัน | TBD (stage1: 1 สำนักงาน/2 บริษัท, stage2: 2 สำนักงาน/6 บริษัท) |
| จำนวนไฟล์ / หน้า / เอกสารเชิงตรรกะ (นับแยก) | TBD / TBD / TBD |

## 2. ผลเปรียบเทียบ baseline vs assisted (ต่อ 100 documents)
| ตัวชี้วัด | Baseline | Assisted | เป้าหมาย |
|---|---|---|---|
| เวลาจัดชุดรวมตรวจแก้และ support | TBD | TBD | ลด ≥ 30% |
| รอบตรวจต่อเอกสาร | TBD | TBD | — |
| Rework rate (ชุดที่ถูกส่งกลับ) | TBD | TBD | ไม่แย่กว่า baseline |
| ต้นทุนรวม (OCR+Jev+compute+support) | TBD | TBD | — |
| สาเหตุ rework แยกรายสาเหตุ | TBD | TBD | — |

## 3. คุณภาพ OCR/Jev (วัดแยกชั้น)
| มิติ | ผล | จำนวนตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| OCR recoverability (เลขที่/วันที่/ยอด/tax ID) | TBD | TBD | |
| Candidate recall | TBD | TBD | |
| Field accuracy ก่อน review (เอกสารชัด) | TBD | TBD | เป้า ≥ 95% |
| Classification precision (หมวดที่ auto-route) | TBD | TBD | เป้า ≥ 97% |
| Auto-route: decisions รวม / Wilson lower bound ต่อหมวด | TBD | TBD | ต้อง ≥ 300 และ ≥ 0.95 ต่อหมวด |
| Coverage + error rate | TBD | TBD | เป้า ≥ 40% |
| Duplicate suggestions: false positives | TBD | TBD | |
| False completeness | TBD | TBD | ต้องเป็น 0 |

สุ่มตรวจ 3 กลุ่ม: ที่คนรับ / ที่คนแก้ / ที่ AI บอกไม่รู้ (`buildReviewSample`); ACC ตรวจซ้ำ ≥ 20% รวมเคสกำกวม

## 4. Onboarding และ support
| สำนักงาน/บริษัท | เวลา onboarding | งาน support (นาที) |
|---|---|---|
| TBD | TBD | TBD |

## 5. Willingness-to-pay (DR-906)
สรุปจาก `pilot_wtp_responses`: โมเดลราคาที่ทดสอบ, price band, สัดส่วนที่ต้องการใช้ต่อ — TBD

## 6. ข้อจำกัด
- จำนวนตัวอย่างและช่วงเวลา: TBD
- ผลระยะสั้นห้ามใช้รับรองทั้งเดือน; ถ้ารอบบัญชียังไม่จบ ให้คง pilot ต่อ
- ตัวเลขเป้าหมายใน §30 เป็นข้อเสนอ ไม่ใช่ผลทดสอบ

## 7. การตัดสินใจ
`expand` / `keep_assist` / `adjust_workflow` / `continue_pilot` (จาก `evaluatePilotDecision`): TBD
เหตุผล: TBD
