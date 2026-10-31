# คู่มือการมีส่วนร่วมในโปรเจกต์ DocReady (Contributing Guide)

ขอบคุณที่สนใจร่วมพัฒนา **DocReady** โปรเจกต์ Open Source สำหรับระบบช่วยรับ จัดหมวดหมู่ ตรวจสอบหลักฐาน และส่งออกชุดเอกสารทางบัญชี

---

## 1. กฎเหล็กสถาปัตยกรรมที่ต้องปฏิบัติตาม (Architectural Invariants)

ทุก Pull Request ต้องปฏิบัติตามหลักการใน [`AGENTS.md`](AGENTS.md) อย่างเคร่งครัด:

1. **Dual-Level Multi-Tenant Isolation**:
   - ทุก Resource ต้องผูกกับ `office_id` และ (กรณีข้อมูลลูกค้า) `client_id`
   - ตารางฐานข้อมูลใหม่ใน `supabase/migrations/` ต้องมีทั้ง `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, และ `CREATE POLICY` ที่ตรวจสอบผ่าน `public.user_has_office_access` / `public.user_has_client_access`
2. **Strict Data Precision & Formatting**:
   - ห้ามใช้ `any` ในโค้ด TypeScript (`@typescript-eslint/no-explicit-any`)
   - รหัสเอกสาร (`document_number`), เลขประจำตัวผู้เสียภาษี (`tax_id`), และรหัสสาขา (`branch`) ต้องเป็น `String` เสมอเพื่อรักษาเลข `0` นำหน้า (`T-12`)
   - ยอดเงินต้องใช้ `Decimal String` และคำนวณด้วย Integer-Scaled `BigInt` ห้ามใช้ Floating-Point (`T-14`) และห้ามแทนค่า `missing`/`unreadable` ด้วย `0.00` (`T-15`)
3. **Human-in-the-Loop Validation**:
   - ระบบ OCR และ AI (`jev-1.13.0`) ทำหน้าที่เสนอค่าตัวเลือก (`proposed`) พร้อมอ้างอิงพิกัดหลักฐานเท่านั้น ห้ามอนุมัติข้อมูลการเงินหรือชุดเอกสารแทนมนุษย์แบบเบ็ดเสร็จ
4. **Storage & Export Security**:
   - ใช้ Private Storage Buckets เท่านั้น (`quarantine`, `originals`, `derived`, `exports`) ห้ามตั้งค่า `public: true`
   - ป้องกัน Excel Formula Injection และ ZIP Path Traversal (`T-25`)

---

## 2. ขั้นตอนการตั้งค่าและพัฒนาในเครื่อง (Local Development Setup)

```bash
# 1. ติดตั้ง dependencies ทั้งหมด
pnpm install

# 2. คัดลอกไฟล์ตัวแปรแวดล้อมตัวอย่าง
cp .env.example .env.local

# 3. รัน Linter ตรวจสอบกฎสถาปัตยกรรมและโค้ด
pnpm run lint

# 4. รัน Typecheck ทุกแพ็กเกจใน Monorepo
pnpm run typecheck

# 5. รันชุดทดสอบ Vitest ทั้งหมด
pnpm run test
```

---

## 3. ขั้นตอนการส่ง Pull Request (Pull Request Checklist)

- [ ] โค้ดผ่าน `pnpm run lint` โดยไม่มีข้อผิดพลาด
- [ ] โค้ดผ่าน `pnpm run typecheck` ครบทั้ง 9 แพ็กเกจ/แอป
- [ ] โค้ดผ่าน `pnpm run test` และมี Unit/Integration Test ครอบคลุมฟีเจอร์หรือบั๊กที่แก้ไข
- [ ] ไม่มีข้อมูลจริงของลูกค้า (PII / เลขภาษีจริง) หรือความลับ (API Keys / Tokens) ปะปนอยู่ในโค้ดหรือไฟล์ทดสอบ
