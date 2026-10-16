# Synthetic Fixtures & Dataset Inventory Guide (DR-004)

**เวอร์ชัน:** 1.0 | **วันที่:** 6 ตุลาคม 2026

---

## 1. ภาพรวมชุดข้อมูลสังเคราะห์ (Synthetic Dataset Overview)

ไดเรกทอรีนี้เก็บโครงสร้างและตัวอย่างไฟล์สำหรับชุดข้อมูลสังเคราะห์ (Synthetic Fixture Dataset) จำนวน 100 รายการ เพื่อใช้สำหรับการทดสอบการทำงานของระบบ (Integration Testing), การประเมินความแม่นยำของ OCR และ Jev (`packages/ocr`, `packages/ai`), และการตรวจสอบความปลอดภัยของสิทธิ์การเข้าถึงข้อมูล (Multi-tenant Isolation Tests)

---

## 2. โครงสร้างไฟล์ชุดข้อมูล (Directory Layout)

```text
fixtures/
  manifest.json              # บัญชีสรุปรายการเอกสารสังเคราะห์ 100 รายการ (Metadata & Ground Truth)
  synthetic/
    README.md                # เอกสารคู่มือชุดข้อมูลสังเคราะห์นี้
    images/                  # ภาพ/PDF สังเคราะห์ (มีลายน้ำ DEMO / SYNTHETIC)
      syn_tax_inv_001.pdf
      syn_receipt_be_002.pdf
      ...
    labels/                  # JSON Label สกัดตำแหน่ง Ground Truth Spans & Polygons
      syn_tax_inv_001.json
      syn_receipt_be_002.json
      ...
```

---

## 3. กฎความปลอดภัยและการทำลายน้ำ (Safety & Watermarking Rules)

1. **ห้ามใช้ข้อมูลจริงของลูกค้าใน Fixtures**: เอกสารสังเคราะห์ทั้งหมดต้องใช้ชื่อบริษัทสมมติ (เช่น "บริษัท ลูกค้าทดสอบ 1 จำกัด") เลขภาษีสมมติ (เช่น "0105559009999")
2. **มีลายน้ำ DEMO / SYNTHETIC เด่นชัด**: ทุกภาพ/PDF สังเคราะห์ต้องมีลายน้ำสีส้ม/เทาตัวใหญ่ระบุว่า `DEMO / SYNTHETIC` เพื่อป้องกันการสับสนนำไฟล์ทดสอบไปยื่นภาษีจริง
3. **การทดสอบความเสี่ยง (Adversarial Tests)**: ชุดข้อมูลรวมเคสทดสอบพิเศษ เช่น Prompt Injection ในข้อความ OCR, เลขศูนย์นำหน้า (`004812`), วันที่ พ.ศ. (`2569`), และรูปภาพสลิปใบเสร็จรับเงิน thermal จาง เพื่อทดสอบความคงทนของระบบ (Robustness)
