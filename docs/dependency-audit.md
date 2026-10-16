# DocReady — External Dependencies & Provider Audit Specification (DR-006)

**เวอร์ชัน:** 1.0 | **วันที่:** 6 ตุลาคม 2026 | **สถานะ:** S0 Spec Approved

---

## 1. รายการผู้ให้บริการและระบบภายนอก (Dependency Matrix)

| บริการ / เครื่องมือ | บทบาทในระบบ | เวอร์ชัน / Region | นโยบายต้นทุน / Quota | Mock Strategy สำหรับ Dev/Test |
|---|---|---|---|---|
| **Azure Document Intelligence** | OCR Engine อ่านข้อความและตำแหน่ง Polygon | Read Model (v4.0 GA / `2024-11-30`) | ~$1.50 ต่อ 1,000 หน้า | `MockOCRProvider` ส่งคืน Span/Polygon สังเคราะห์จาก Fixtures |
| **Jev Engine (TypeSafe)** | AI Decision Provider เลือก candidate/หมวดหมู่ | Model `jev-1.13.0` (Pinned) | $0.042 ต่อ 1M Input Tokens (Output Free) | `MockDecisionProvider` คืนค่า Choice/Noul ตาม Rule-based Baseline |
| **Supabase (PostgreSQL)** | Auth + Relational DB + Row Level Security | PostgreSQL 15+ (Southeast Asia) | Database Instance Quota | Local Supabase Docker / SQLite Fixture DB |
| **Supabase Private Storage** | จัดเก็บไฟล์ต้นฉบับและไฟล์ส่งออก | Private Buckets เท่านั้น | Egress & Storage Quota | Local Filesystem / MinIO S3 Mock Bucket |
| **pg-boss** | Queue สำหรับ Worker ประมวลผลเบื้องหลัง | Node.js Worker Job Queue | PostgreSQL Table-based | Local Worker In-Memory / Test Mode Queue |

---

## 2. การเชื่อมต่อ OCR Provider (`packages/ocr`)

```ts
export interface OCRInput {
  assetId: string;
  fileBuffer: Buffer;
  mimeType: string;
  pageRange?: string;
}

export interface OCROperation {
  operationId: string;
  submittedAt: string;
  provider: 'azure_read' | 'mock';
}

export interface OCRProvider {
  submit(input: OCRInput, signal?: AbortSignal): Promise<OCROperation>;
  poll(operation: OCROperation, signal?: AbortSignal): Promise<OCRStatus>;
}
```

### ข้อควรระวังและการจัดการ OCR:
1. **Async Submit & Poll**: การอ่าน OCR เป็นงาน Async (Worker ต้องบันทึก `operation_id` ลง DB เพื่อให้ Resume พอลลิงได้หลัง Restart)
2. **Coordinate & Unicode Mapping**: ต้องแปลง Bounding Boxes และ Spans ของ Azure Read ให้อยู่ในรูปแบบ Normalized Coordinates `(0.0 - 1.0)` เพื่อใช้ Highlight บน Web Viewer

---

## 3. การเชื่อมต่อ Jev Decision Engine (`packages/ai`)

```ts
export interface DecisionInput {
  documentId: string;
  questionType: 'document_roles' | 'select_candidate_span' | 'party_matching';
  ocrSpans: Array<{ id: string; text: string }>;
  candidateIds: string[];
}

export interface DecisionResult {
  decisionRunId: string;
  selectedCandidateId: string | null;
  confidence: number;
  providerVersion: 'jev-1.13.0' | 'mock_baseline';
}

export interface DecisionProvider {
  evaluate(input: DecisionInput, signal?: AbortSignal): Promise<DecisionResult>;
}
```

### ข้อควรระวังสำหรับการใช้งาน Jev:
1. **Pin Version**: ต้อง Pin เวอร์ชัน `jev-1.13.0` ห้ามใช้ Floating Tag
2. **Untrusted Input Constraint**: ข้อความจาก OCR ถือเป็น Untrusted Input ห้ามนำข้อความในเอกสารมาตัดสิทธิ์ด้าน Authorization หรือข้ามการ Validate ทางธุรกิจในโค้ด
3. **Choice & Noul Only**: ถามคำถามในกรอบที่จำกัด (`Choice` เหนือ candidate span IDs หรือ candidate block IDs) โดยคำถามทุกชุดต้องมีตัวเลือก `none/ambiguous`
