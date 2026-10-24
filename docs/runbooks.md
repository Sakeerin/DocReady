# Runbooks (DR-803, DR-806)

> เอกสารนี้เป็นร่างสำหรับทีม ต้องซ้อมจริงบน staging ก่อนลงนามพร้อม pilot

## 1. Release
1. `pnpm install --frozen-lockfile && pnpm run typecheck && pnpm run test` ต้องผ่านทั้งหมด
2. Apply migrations ตามลำดับชื่อไฟล์ใน `supabase/migrations/` บน staging ก่อน
3. ยืนยัน `auto_approval_enabled = false` (constraint ใน `feature_flags` บังคับไว้)
4. Smoke test: upload → OCR → review → approve → export → download
5. Deploy production; เฝ้าดู error codes/queue depth 30 นาที

## 2. Rollback
- โค้ด: redeploy build ก่อนหน้า (migrations เป็น additive; ห้าม drop ตารางที่มีข้อมูล)
- ถ้าพบข้อมูลผิด: เปิด kill switch `DOCREADY_KILL_EXPORT=1` ก่อน แล้วค่อยแก้

## 3. Kill switches
| ตัวแปร | ผล |
|---|---|
| `DOCREADY_KILL_OCR=1` | หยุดส่ง OCR; รับไฟล์ต่อ สถานะ `delayed_manual` |
| `DOCREADY_KILL_JEV=1` | หยุด Jev; ให้คนจัดหมวดเอง |
| `DOCREADY_KILL_AUTOCLASS=1` | ปิดจัดหมวดอัตโนมัติ |
| `DOCREADY_KILL_EXPORT=1` | หยุดสร้าง export ใหม่ (ชุดที่ตรวจแล้วยังดูได้) |

ปิด AI/OCR ไม่บล็อกการดูและ export ชุดที่ตรวจแล้ว (§32)

## 4. Outage & Restore
- **Worker crash:** restart; งาน OCR resume จาก `operation_id` ที่บันทึกไว้ (`planOcrResume`); submit ที่ไม่ทราบผลลองซ้ำได้จำกัดจำนวนครั้ง แล้วส่ง manual review
- **Provider ล่ม:** เปิด kill switch ที่เกี่ยวข้อง แจ้งสถานะ delayed/manual
- **Restore จาก backup:** ก่อนเปิดระบบต้อง re-apply `asset_tombstones` และ `legal_holds` เพื่อไม่ให้ OCR/export ของที่ลบแล้ว (T-29); ล้าง queued jobs ของ asset ที่ถูก tombstone

## 5. Secret rotation
1. สร้างคีย์ใหม่ที่ provider/Supabase
2. อัปเดต secret store แล้ว rolling restart worker/web
3. ยกเลิกคีย์เก่า; ตรวจ log ว่าไม่มี secret (`redactDiagnosticText`)

## 6. Support
- ให้ผู้ใช้ส่งเฉพาะ ID (document/export/job) ไม่ส่งเอกสารจริงทางแชท
- Diagnostic logs เก็บเฉพาะ IDs/status/duration/error codes
