# DocReady — Evidence-Backed Accounting Document Preparation & Export Platform

[![CI](https://github.com/Sakeerin/DocReady/actions/workflows/ci.yml/badge.svg)](https://github.com/Sakeerin/DocReady/actions/workflows/ci.yml)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen)](https://github.com/Sakeerin/DocReady)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**DocReady** เป็นโปรเจกต์ **Open Source** สำหรับระบบช่วยรับเอกสาร (Intake), จัดหมวดหมู่, สกัดข้อมูลพร้อมพิกัดหลักฐานบนภาพต้นฉบับ (Evidence-Backed OCR & Jev Decision), ตรวจสอบความครบถ้วนของชุดเอกสารประจำงวด (Checklist & Expected Items), ติดตามเอกสารที่ขาดจากลูกค้า, และสร้างชุดส่งออกเอกสาร (`XLSX` + `Split PDF` + `manifest.json`) สำหรับสำนักงานบัญชีและนักพัฒนาที่ต้องการนำไปศึกษา พัฒนาต่อยอด หรือติดตั้งใช้งานเอง (Self-Hosted)

---

## 1. หลักการออกแบบสถาปัตยกรรม (Core Architectural Principles)

1. **Human-in-the-Loop Validation**
   - ระบบ OCR และ AI (`jev-1.13.0`) ทำหน้าที่เสนอค่าตัวเลือก (`proposed`) พร้อมอ้างอิงตำแหน่งบนเอกสารต้นฉบับเท่านั้น **ห้ามอนุมัติตัวเลขทางบัญชี ภาษี หรือชุดเอกสารแทนมนุษย์แบบเบ็ดเสร็จ**
2. **Evidence-Backed Data & Provenance**
   - ทุกฟิลด์ที่สกัดได้จะผูกกับ `asset_version`, `page`, `ocr_run_id`, `span_ids`, และ `bounding_box` เพื่อให้ผู้ตรวจทานคลิกดูไฮไลต์บนภาพเอกสารจริงได้ทันที
3. **Dual-Level Multi-Tenant Isolation**
   - แยกขอบเขตข้อมูลเป็น 2 ระดับอย่างเด็ดขาด: **Office Scope (`office_id`)** และ **Client Company Scope (`client_id`)** ทั้งที่ระดับ Database Row Level Security (RLS), Composite Foreign Keys, และ Server-Side Repository
4. **Data Precision & Formatting Integrity**
   - เลขที่เอกสาร (`document_number`), เลขประจำตัวผู้เสียภาษี (`tax_id`), และรหัสสาขา (`branch`) เก็บเป็น `String` เสมอเพื่อรักษาเลข `0` นำหน้า (`T-12`)
   - ยอดเงินและภาษีใช้ `Decimal String` และคำนวณด้วย Integer-Scaled `BigInt` เพื่อป้องกันปัญหา Floating-Point Rounding (`T-14`) และห้ามแทนค่าที่อ่านไม่ออก (`missing` / `unreadable`) ด้วย `0.00` (`T-15`)
5. **Immutable Source & Approved Package Snapshot**
   - การอนุมัติชุดเอกสารเป็นการสร้าง Snapshot ที่แก้ไขย้อนหลังไม่ได้ หากมีการแก้ไขเอกสารหรือ Checklist ในภายหลัง ระบบจะยกเลิกสถานะอนุมัติสำหรับการส่งออกใหม่ (`invalidated_by_change`) โดยอัตโนมัติ แต่ยังคงรักษา Snapshot เดิมไว้เพื่อการตรวจสอบย้อนหลัง (`T-21`)

---

## 2. โครงสร้างโปรเจกต์ (Monorepo Structure)

โปรเจกต์จัดการด้วย `pnpm` workspace แบ่งออกเป็นแอปพลิเคชันและแพ็กเกจแยกตามขอบเขตหน้าที่:

```text
DocReady/
├── apps/
│   ├── web/                 # Next.js 14 App Router (Office Reviewer UI, Client Portal, REST APIs)
│   └── worker/              # Background Worker (Quarantine Scan, Async OCR Polling, Jev, Export Jobs)
├── packages/
│   ├── contracts/           # Zod Schemas, DTOs, Provider Interfaces
│   ├── domain/              # Pure Domain Logic (Field States, Checklist Readiness, Package Invariance)
│   ├── db/                  # Tenant-Aware Repository & Optimistic Concurrency Control
│   ├── files/               # Magic Byte Validation, PDF Page Bomb Guard, SHA-256 Hashing
│   ├── ocr/                 # Multi-Provider OCR Adapters (Azure Read, Google Vision, Vision LLM, Mock)
│   ├── ai/                  # Jev Decision Adapter (jev-1.13.0), Bounded Questions & Evaluation
│   └── exports/             # 5-Sheet XLSX Specification, Manifest Builder, Safe ZIP Bundler
├── supabase/
│   └── migrations/          # PostgreSQL Schemas, Composite FKs & Dual-Level RLS Policies
├── tests/                   # Vitest Unit, Integration & Multi-Tenant Security Test Suites
├── fixtures/                # Synthetic Evaluation Dataset & Ground-Truth Manifest
└── docs/                    # Product Brief, Field Dictionary, Checklist Policy, Evaluation Report
```

---

## 3. ฟีเจอร์หลักตามระยะการพัฒนา (Implementation Phases)

| ระยะ | สถานะ | รายละเอียดความสามารถหลัก |
|---|---|---|
| **S0: Discovery & Dataset** | Completed | กำหนดพจนานุกรมข้อมูล ([`document-field-dictionary.md`](docs/document-field-dictionary.md)), นโยบายความครบถ้วน ([`checklist-policy.md`](docs/checklist-policy.md)) และชุดข้อมูลทดสอบสังเคราะห์ |
| **S1: System Foundation** | Completed | โครงสร้าง Monorepo, Dual-Level RLS (`office_id`, `client_id`), และการป้องกันข้อมูลรั่วไหลข้ามบริษัทลูกค้า |
| **S2: Secure File Upload** | Completed | ระบบอัปโหลด 2 ขั้นตอนผ่าน `quarantine` bucket, ตรวจ Magic Bytes/PDF Page Bomb, และหน้าจัดกลุ่มหน้าเอกสาร (Manual Page Grouping) |
| **S3: Multi-Provider OCR** | Completed | รองรับ `azure_read`, `google_vision`, `vision_llm`, และ `mock` พร้อมแปลงพิกัดเป็น Normalized Spans และ `EvidenceHighlightOverlay` |
| **S4: Jev & Field Rules Engine** | Completed | เชื่อมต่อ `jev-1.13.0` ด้วย Bounded Questions, ตรวจสอบสมการยอดเงิน (`subtotal + stated_tax = grand_total`), ตรวจจับเลขผู้เสียภาษีสลับฝั่งผู้ซื้อ-ผู้ขาย และบันทึก Token Usage Ledger |
| **S5: Human Review & Duplicates** | Completed | ระบบ Optimistic Concurrency Control (`expected_revision` / `409 Conflict`), ตรวจจับเอกสารซ้ำทั้งระดับไฟล์ (`SHA-256`) และระดับความหมาย (`Semantic Duplicate`), และแยกความสัมพันธ์ `supports` vs `duplicate_of` |
| **S6: Checklists & Missing Requests** | Completed | นำเข้ารายการเอกสารที่คาดหวังผ่าน CSV, ผูกเอกสารเข้ากับ Checklist, ระบบส่งคำขอเอกสารเพิ่มให้ลูกค้า (`draft` → `published` → `responded` → `resolved`), และคำนวณ `coverage_basis` |
| **S7: Package Export & Usage Ledger** | Completed | สร้าง Immutable Package Snapshot, ส่งออก `XLSX` 5 ชีต (`Documents`, `EvidenceIndex`, `Checklist`, `Exceptions`, `PackageInfo`) + ไฟล์ PDF แยกตาม `page_range` + `manifest.json`, แยก `counting_role` ไม่นับยอดใบเสร็จซ้ำกับใบแจ้งหนี้, แยกยอดรวมตามสกุลเงิน, และหน้า Dashboard รายงานผลการปฏิบัติงานและโควตา |
| **S8: QA, Hardening & Security** | Code complete (UAT/staging pending) | ครบ test matrix T-01–T-30, fair queue, kill switches, log redaction, tombstone/legal hold; UAT 30 เคส, load test จริง และ staging sign-off ต้องดำเนินการโดยทีม ([`docs/pilot-readiness-checklist.md`](docs/pilot-readiness-checklist.md)) |
| **S9: Pilot Deployment** | Tooling complete (pilot not yet run) | เครื่องมือประเมิน pilot: Wilson gate สำหรับ auto-classification, สุ่มตรวจ 3 กลุ่ม, pilot metrics/decision ที่ตอบ `insufficient_sample` เมื่อข้อมูลไม่พอ, [`docs/pilot-playbook.md`](docs/pilot-playbook.md) และ [`docs/pilot-report.md`](docs/pilot-report.md) (ผลจริงยังเป็น TBD) |

---

## 4. การติดตั้งและรันระบบ (Getting Started)

### ข้อกำหนดเบื้องต้น (Prerequisites)
- **Node.js** `>= 18.0.0`
- **pnpm** `>= 9.0.0`

### ขั้นตอนการติดตั้ง
```bash
# 1. ติดตั้ง dependencies ทั้งหมดใน Monorepo
pnpm install

# 2. รัน Linter ตรวจสอบกฎสถาปัตยกรรมและโค้ด
pnpm run lint

# 3. ตรวจสอบความถูกต้องของ TypeScript ทั้งหมดทุกแพ็กเกจและแอป
pnpm run typecheck

# 4. รันชุดทดสอบอัตโนมัติ (Vitest)
pnpm run test

# 5. รันระบบในโหมดพัฒนา (Next.js Web App + Background Worker)
pnpm run dev
```

---

## 5. ชุดทดสอบและการรับประกันคุณภาพ (Verification & Test Matrix)

รันคำสั่ง `pnpm run test` เพื่อตรวจสอบชุดทดสอบทั้งหมดในโฟลเดอร์ [`tests/`](tests/):

- [`tests/security/multi_tenant_isolation.test.ts`](tests/security/multi_tenant_isolation.test.ts): ทดสอบการกั้นข้อมูลระหว่างสำนักงานบัญชีและระหว่างบริษัทลูกค้า (`T-01`, `T-02`)
- [`tests/upload_and_manual_review.test.ts`](tests/upload_and_manual_review.test.ts): ทดสอบการบล็อกไฟล์อันตราย/ไฟล์เกินขนาด, การบังคับจัดกลุ่มหน้าเอกสารครบทุกหน้า, และการรักษาเลข `0` นำหน้า (`T-04`, `T-05`, `T-12`, `T-15`)
- [`tests/ocr_baseline_eval.test.ts`](tests/ocr_baseline_eval.test.ts): ทดสอบ Multi-provider OCR Adapter และการดึงพิกัดหลักฐาน (`Spans` & `BoundingBox`)
- [`tests/jev_rules_eval.test.ts`](tests/jev_rules_eval.test.ts): ทดสอบ Jev Bounded Questions, การตรวจยอดเงิน/ภาษี, และการป้องกัน Stale AI Job เขียนทับค่าที่มนุษย์ยืนยันแล้ว (`T-14`)
- [`tests/duplicate_and_revision.test.ts`](tests/duplicate_and_revision.test.ts): ทดสอบ Revision Conflict (`409`), การตรวจจับเอกสารซ้ำข้ามงวด, และการผูกความสัมพันธ์ `supports` (`T-16`, `T-17`, `T-19`)
- [`tests/checklist_and_requests.test.ts`](tests/checklist_and_requests.test.ts): ทดสอบการซ่อน `draft` / `internal_note` จากฝั่งลูกค้า, การป้องกันลูกค้ากดปิดคำขอเอง (`T-23`), และการห้ามเคลมความครบถ้วน 100% เมื่อไม่มีรายการอ้างอิง (`T-22`)
- [`tests/package_export_and_usage.test.ts`](tests/package_export_and_usage.test.ts): ทดสอบการยกเลิกสถานะอนุมัติเมื่อแก้ไขข้อมูลหลังอนุมัติ (`T-21`), การไม่นับยอดซ้ำของเอกสารแนบ (`T-17`), การแยกสกุลเงิน (`T-28`), การป้องกัน Formula Injection & Path Traversal (`T-25`), การบล็อกไฟล์ปะปนข้ามบริษัท (`T-10`), และการตรวจสิทธิ์ดาวน์โหลดซ้ำ (`T-26`, `T-27`)

---

## 6. เอกสารอ้างอิงภายในโปรเจกต์ (Documentation)

- [`AGENTS.md`](AGENTS.md) — กฎเหล็กสถาปัตยกรรมและแนวทางการพัฒนาสำหรับ AI Agent และนักพัฒนา
- [`implementation_plan_docready.md`](implementation_plan_docready.md) — แผนแม่บทการออกแบบระบบและรายละเอียด Task ทั้งหมด (`DR-001` – `DR-904`)
- [`docs/product-brief.md`](docs/product-brief.md) — ขอบเขตผลิตภัณฑ์และบทบาทผู้ใช้งาน
- [`docs/document-field-dictionary.md`](docs/document-field-dictionary.md) — มาตรฐานฟิลด์ข้อมูลเอกสารและกฎการตรวจสอบ
- [`docs/checklist-policy.md`](docs/checklist-policy.md) — นโยบายการประเมินความครบถ้วนของเอกสารประจำงวด
- [`docs/evaluation-report.md`](docs/evaluation-report.md) — รายงานผลการประเมินความแม่นยำระหว่าง Baseline กับ Jev Pipeline

---

## 7. Open Source, การมีส่วนร่วม และสัญญาอนุญาต (Open Source & License)

โปรเจกต์ **DocReady** เปิดเผยซอร์สโค้ดในรูปแบบ **Open Source** เพื่อให้ชุมชนนักพัฒนาและสำนักงานบัญชีสามารถนำไปใช้งาน ตรวจสอบความโปร่งใสของอัลกอริทึม และร่วมกันพัฒนาต่อยอดได้

### แนวทางการร่วมพัฒนา (Contributing)
1. ศึกษากฎเหล็กสถาปัตยกรรมและแนวทางการเขียนโค้ดใน [`AGENTS.md`](AGENTS.md) และ [`CONTRIBUTING.md`](CONTRIBUTING.md)
2. สำหรับการรายงานช่องโหว่ด้านความปลอดภัย โปรดศึกษา [`SECURITY.md`](SECURITY.md)
3. สร้าง Branch ใหม่จาก `main` สำหรับฟีเจอร์หรือการแก้ไขบั๊ก
4. ตรวจสอบให้แน่ใจว่าโค้ดผ่าน `pnpm run lint`, `pnpm run typecheck` และ `pnpm run test` ครบทุกชุดทดสอบก่อนเปิด Pull Request

### สัญญาอนุญาต (License)
เผยแพร่ภายใต้สัญญาอนุญาตแบบเปิด ([**MIT License**](LICENSE))

