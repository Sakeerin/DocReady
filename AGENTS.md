# AGENTS.md — Agent Guidelines & Technical Instructions for DocReady

เอกสารนี้เป็นคำสั่ง คู่มือการปฏิบัติงาน และหลักการออกแบบสถาปัตยกรรม (Architectural Invariants) สำหรับ AI Agent (รวมถึง Antigravity และ Subagents) ที่เข้ามาทำงานในโปรเจกต์ **DocReady** โดยอ้างอิงและถอดความจาก [`implementation_plan_docready.md`](file:///d:/Projects/DocReady/implementation_plan_docready.md) อย่างเคร่งครัด

---

## 1. ภาพรวมผลิตภัณฑ์และเป้าหมาย (Product Overview & Philosophy)

**DocReady** เป็นระบบช่วยรับ จัดหมวด ตรวจสอบหลักฐาน (Evidence Tracking) ตรวจสอบความครบถ้วนของชุดเอกสาร (Checklist & Expected Items) และจัดชุดส่งออกเอกสารให้สำนักงานบัญชีทำบัญชีต่อได้รวดเร็วและแม่นยำ

### ปรัชญาและหลักการสำคัญ (Core Principles)
1. **Human-in-the-Loop Validation**: ระบบ AI/OCR มีหน้าที่เสนอข้อมูล (Proposals) พร้อมหลักฐานตำแหน่งบนภาพต้นฉบับ ห้ามอนุมัติข้อมูลการเงิน ตัวเลขภาษี หรือชุดเอกสารแทนมนุษย์แบบเบ็ดเสร็จ
2. **Evidence-Backed Data**: ทุกค่าที่สกัดมาต้องเก็บ Traceability (Provenance) อ้างอิงถึงหน้า, สเปนตัวอักษร (`spans`), หรือ Polygon พิกัดบนภาพต้นฉบับได้เสมอ
3. **Multi-tenant Isolation by Design**: ข้อมูลแยกตามระดับ **Office Scope** และ **Client Company Scope** อย่างเด็ดขาด ป้องกันข้อมูลรั่วไหลข้ามบริษัททุกกรณี
4. **Immutable Source & Snapshot**: เอกสารต้นฉบับ (`source_assets`) และชุดเอกสารที่อนุมัติแล้ว (`packages`) ต้องเป็น snapshot ที่ห้ามแก้ไขย้อนหลังโดยตรง

---

## 2. กฎเหล็กสถาปัตยกรรมที่ไม่ยอมให้ละเมิด (Architectural Invariants)

ทุกการแก้ไขโค้ดต้องปฏิบัติตามกฎเหล็กเหล่านี้ หากพบว่าโค้ดที่เขียนละเมิดข้อใดข้อหนึ่ง ให้ถือว่างานนั้น **ไม่ผ่าน (Failed)**:

### 2.1 Multi-Tenant & Authorization Controls
- **Dual-Level Scope**: ทุก Resource ในระบบต้องระบุ `office_id` และ (ถ้าเกี่ยวกับบริษัทลูกค้า) `client_id`
- **Strict Scope Verification**: ห้ามพึ่งพาแค่ UI ในการซ่อนปุ่ม ให้ตรวจสิทธิ์และ scope ที่ Server-Side API และ Repository Layer เสมอ
- **Composite Foreign Keys**: ใช้ Composite FK เช่น `(office_id, client_id, document_id)` เพื่อป้องกันการโยงข้อมูลข้ามบริษัทลูกค้า
- **RLS Safeguards**: ใช้ PostgreSQL Row Level Security (RLS) ร่วมกับการสืบค้นในโค้ด ห้ามใช้ Service Key บายพาส RLS โดยไม่ผ่าน Tenant-Aware Repository

### 2.2 Storage & File Handling Security
- **Private Buckets Only**: ใช้ Supabase Private Storage เท่านั้น (`quarantine`, `originals`, `derived`, `exports`) **ห้ามสร้าง Public Bucket เด็ดขาด**
- **2-Step Secure Upload**:
  1. `POST /api/uploads/sessions` จอง URL อายุสั้นใน `quarantine`
  2. `POST /api/uploads/[id]/complete` ตรวจสอบไฟล์จริงบน storage ทั้งขนาด, Magic Bytes, Hash และ MIME type ก่อนย้าย/ลง DB
- **Sandboxed Processing**: การพาร์ส PDF/ภาพ และการทำ Preview ต้องรันใน Sandboxed Container/Process จำกัด CPU/RAM/Time/Page count และ**ไม่อนุญาตให้เปิด Network outbound ในขั้นตอน Parser**
- **No Unsafe File Access**: ป้องกัน Path Traversal ในการสร้าง ZIP และ sanitized filenames ก่อนให้ผู้ใช้ดาวน์โหลด

### 2.3 Data Integrity & Precision
- **String Identifiers**: เลขที่เอกสาร (`document_number`), เลขผู้เสียภาษี (`tax_id`), และสาขา (`branch`) ต้องเก็บเป็น `String` เพื่อรักษา 0 ตัวหน้าและขีด/อักษรพิเศษไว้เสมอ **ห้ามแปลงเป็น Number/Float**
- **Decimal Arithmetic**: ยอดเงินรวม (`grand_total`), ภาษี (`stated_tax`), ยอดก่อนภาษี (`subtotal`) ต้องใช้ประเภท `Decimal` หรือ `Decimal String` ใน API ห้ามใช้ Floating-Point float64 ที่มีปัญหา rounding error
- **Missing != Zero**: ข้อมูลที่อ่านไม่ได้หรือไม่ได้ระบุ (`missing/unreadable`) ต้องมีสถานะเป็น `missing` หรือ `unreadable` **ห้ามแทนค่าด้วย 0.00 โดยเด็ดขาด**
- **Explicit Provenance**: ค่าที่มาจากมนุษย์แก้ไข (`status: "confirmed"`) ห้ามถูก AI/OCR ประมวลผลทับแบบเงียบ ๆ (Stale job resolution)

### 2.4 Approved Package Immutability
- การอนุมัติแพ็กเกจ (`approved package`) เป็นการสร้าง Snapshot ของเวอร์ชันเอกสาร, Checklist, และ Expected Items ในเวลานั้น
- หากมีการเปลี่ยนแปลงแก้ไข field หรือเอกสารในภายหลัง ต้องยกเลิกอนุมัติหรือสร้าง Package Revision ใหม่ Snapshot เดิมต้องคงไว้เพื่อการ Audit ย้อนหลัง

---

## 3. โครงสร้างโปรเจกต์ (Monorepo Workspace Structure)

โปรเจกต์ DocReady ออกแบบเป็น Monorepo โดยแบ่งแยกขอบเขตงานชัดเจนใน `d:\Projects\DocReady`:

```text
DocReady/
  apps/
    web/                 # Next.js App Router (Portal, Office UI, Authenticated APIs)
    worker/              # Node.js Worker + pg-boss (Scan, OCR Polling, Decisions, Export Worker)
  packages/
    domain/              # Pure domain logic (Field states, Checklist rules, Duplicate matching, Package invariance)
    contracts/           # Zod schemas, API contracts, Provider interfaces (OCR, Decision)
    db/                  # Repositories, Tenant-aware transactions, Migration runners
    ocr/                 # OCR Provider interfaces, Azure Doc Intel Read / Mock adapters, Evidence normalizers
    ai/                  # Jev decision adapters (jev-1.13.0), Prompts/Questions, Evaluation runners
    files/               # File signature validation, Safe preview generation, Hashing, Provenance
    exports/             # ExcelJS workbook generation, Manifest schema, ZIP packaging
  supabase/
    migrations/          # SQL database schemas, RLS policies, Functions, Grants
  tests/                 # Vitest domain/integration tests, Security isolation tests, Playwright E2E
  fixtures/              # Synthetic document images, Approved anonymized test sets
  docs/                  # Architecture specs, Field dictionary, Evaluation reports, ADRs, Runbooks
```

---

## 4. ผู้ให้บริการภายนอกและการเชื่อมต่อ (OCR & AI Provider Guidelines)

### 4.1 OCR Pipeline (`packages/ocr`)
- **Primary Provider**: Azure Document Intelligence Read (`OCRProvider` interface)
- **Async & Resumable**: การประมวลผล OCR เป็น Async (Submit -> Poll) ต้องบันทึก `operation_id` ลง DB เพื่อให้ Worker สามารถ Resume การ Poll ต่อได้หลัง Restart
- **Evidence Mapping**: เก็บ raw OCR response ชั่วคราว และแปลงเป็น normalized spans/lines/words พร้อมพิกัด bounding box เพื่อใช้ทำ Highlight บน UI Viewer

### 4.2 Jev Pipeline (`packages/ai`)
- **Jev Version**: Pin เวอร์ชัน `jev-1.13.0`
- **Bounded Questions**: ถามคำถามในกรอบที่จำกัด (`Choice` เหนือ candidate span IDs หรือ candidate block IDs)
- **Untrusted Input Warning**: ตัวข้อความ OCR ถือเป็น Untrusted Input ห้ามนำคำสั่ง หรือการตัดสินใจเรื่อง Authorization/Business Rules ไปผูกกับคำตอบ AI โดยตรง

---

## 5. แผนการพัฒนาและแผนที่ของระบบ (Implementation Roadmap & Phases)

การพัฒนาจะแบ่งออกเป็น 10 ระยะ (S0 - S9) ตามรายละเอียดใน [`implementation_plan_docready.md`](file:///d:/Projects/DocReady/implementation_plan_docready.md):

| ระยะ | สรุปเป้าหมาย | Key Deliverables |
|---|---|---|
| **S0** | Discovery & Dataset | Field dictionary, Checklist template, Baseline synthetic dataset 100 docs |
| **S1** | System Foundation & Security Scope | Auth (Supabase), Dual-level RLS, Base Monorepo app shell, CI |
| **S2** | Secure File Upload & Manual Workflow | Quarantine storage, Malware/PDF scan, Safe Viewer, Page Grouping (Manual) |
| **S3** | OCR & Evidence Mapping | Azure Doc Intel adapter, Spans & Polygons mapping, Evidence Viewer |
| **S4** | Jev & Field Rules Engine | Bounded questions, Document classification, Amount/Date parsing & validation |
| **S5** | Human Review & Duplicate Matching | Side-by-side review UI, Hash/Semantic duplicate flags, Revision tracking |
| **S6** | Checklist & Missing Document Requests | Versioned checklists, Expected items matching, Client Portal missing request UI |
| **S7** | Package Export & Usage Ledger | Approved snapshot exports (XLSX + ZIP + Manifest), Usage metrics & Cost Ledger |
| **S8** | QA, Hardening & Security Testing | Multi-tenant isolation test suite, Load test, Disaster recovery runbooks |
| **S9** | Pilot Deployment & Operational Evaluation | Pilot with 2 accounting firms / 6 client companies, Evaluation reporting |

---

## 6. ข้อกำหนดในการเขียนโค้ดและการทดสอบ (Coding Standards & Test Requirements)

### 6.1 Coding Standards
- **Strict TypeScript**: ห้ามใช้ `any` ให้ใช้ Zod Schemas ในการ Validate ข้อมูลเข้า-ออก API และ External Service
- **Idempotency**: API Endpoint ที่เป็น Mutation หรือ Job Handler ต้องออกแบบให้เป็น Idempotent (ใช้ `Idempotency-Key` หรือ `outbox_events`)
- **No Direct Mutation of Globals**: State ในการแก้เอกสารต้องผ่าน Revision Tracking
- **Error Handling**: ส่งคืน HTTP Status Code ที่ตรงความหมาย (`401`, `403`, `404` เพื่อไม่เปิดเผย Resource, `409` Revision conflict, `422` Validation fail) ห้ามหลุด Secrets หรือ Stack trace ของ Cloud Provider ให้ผู้ใช้เห็น

### 6.2 Test Matrix Enforcement (`tests/`)
ทุกการเขียน Code ใน Core Features ต้องมี Test อย่างน้อย 1 ชุดที่ครอบคลุม Test Cases ต่อไปนี้:
- **T-01 & T-02**: Multi-tenant isolation (User Office A ห้ามเข้าถึง Document/Object ของ Office B หรือ Client B)
- **T-04 & T-05**: Malformed / Malware / Page Bomb files ต้องติด Quarantine และ Reject ได้อย่างปลอดภัย
- **T-12**: Formatting preservation (Maintain leading zeroes for doc numbers and tax IDs)
- **T-14 & T-15**: Precision checks (No float rounding on monetary amounts; Missing amount is not zero)
- **T-20 & T-21**: Snapshot invariance (Modifying data invalidates previous un-exported approvals)
- **T-25**: Security checks (No path traversal in ZIP, No formula injection in ExcelJS)

---

## 7. Definition of Done (DoD) สำหรับ AI Agent

ในการแจ้งปิด Task หรือทำ Pull Request แต่ละครั้ง AI Agent ต้องตรวจสอบให้แน่ใจว่า:
1. [ ] โค้ดตรงตามข้อกำหนดใน [`implementation_plan_docready.md`](file:///d:/Projects/DocReady/implementation_plan_docready.md) และสอดคล้องกับ Task ID (`DR-xxx`)
2. [ ] มีการตรวจสิทธิ์และ Multi-tenant isolation ทั้งที่ API และ DB Layer
3. [ ] ผ่าน Type Check (`tsc`), Linter และไม่มี Lint Warnings ค้าง
4. [ ] มี Unit / Integration Test สำหรับกรณีปกติและกรณี Edge Case / Security Risks
5. [ ] ไม่ละเมิด Architectural Invariants ในข้อ 2
