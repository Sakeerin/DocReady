# นโยบายความมั่นคงปลอดภัย (Security Policy)

**DocReady** ให้ความสำคัญสูงสุดกับความมั่นคงปลอดภัยของข้อมูลทางการเงิน เอกสารภาษี และการแยกขอบเขตข้อมูลระหว่างสำนักงานบัญชีและบริษัทลูกค้า (Multi-Tenant Isolation)

---

## 1. มาตรการความปลอดภัยหลักของระบบ (Security Controls)

- **Dual-Level Row Level Security (RLS)**: บังคับใช้ `ENABLE ROW LEVEL SECURITY` และ `FORCE ROW LEVEL SECURITY` บนทุกตารางในฐานข้อมูล PostgreSQL พร้อม Composite Foreign Keys `(office_id, client_id, ...)`
- **Private Storage & Quarantine Pipeline**: ไฟล์อัปโหลดทั้งหมดเข้าสู่ถังพัก `quarantine` แบบส่วนตัว ผ่านการตรวจ Magic Bytes (`%PDF-`, JPEG, PNG), การตรวจจับการเข้ารหัส และเพดานจำนวนหน้าก่อนนำไปประมวลผล
- **Untrusted OCR Input Guard (`T-24`)**: ข้อความที่ได้จาก OCR ถือเป็นข้อมูลที่ไม่น่าเชื่อถือ (Untrusted Data) เสมอ ไม่สามารถสั่งเปลี่ยน `office_id`, `client_id`, `revision_number` หรือสถานะการอนุมัติได้
- **Export Sanitization (`T-25`)**: ป้องกัน Excel Formula Injection (`=`, `+`, `-`, `@`) ในไฟล์ `.xlsx` และป้องกัน Path Traversal (`..`) ในการสร้างและแตกไฟล์ `.zip`
- **Diagnostic Log Redaction (`DR-804`)**: ปกปิดเลขประจำตัวผู้เสียภาษี 13 หลัก, JWT, Bearer Tokens และ API Keys ออกจากข้อความ Log โดยอัตโนมัติ

---

## 2. การรายงานช่องโหว่ด้านความปลอดภัย (Reporting a Vulnerability)

หากท่านพบช่องโหว่ด้านความปลอดภัย เช่น การรั่วไหลของข้อมูลข้าม Tenant (Cross-Tenant Data Leak), การข้ามขั้นตอนการตรวจสอบสิทธิ์, หรือช่องโหว่ในการประมวลผลไฟล์:

1. **กรุณาอย่าเปิด Public Issue บน GitHub** สำหรับช่องโหว่ที่ยังไม่ได้รับการแก้ไข
2. แจ้งรายละเอียดช่องโหว่ผ่านฟีเจอร์ **GitHub Private Vulnerability Reporting (Security Advisories)** ของคลังซอร์สโค้ด [`Sakeerin/DocReady`](https://github.com/Sakeerin/DocReady/security/advisories)
3. ระบุขั้นตอนการจำลองปัญหา (Reproduction Steps), ไฟล์หรือ Endpoint ที่ได้รับผลกระทบ และผลกระทบที่อาจเกิดขึ้น เพื่อให้นักพัฒนาสามารถตรวจสอบและออกแพตช์แก้ไขได้อย่างรวดเร็ว
