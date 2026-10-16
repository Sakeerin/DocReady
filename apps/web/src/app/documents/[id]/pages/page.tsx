import React from 'react';
import { TenantHeader } from '../../../../components/TenantHeader';

export default function PageGroupingPage({ params }: { params: { id: string } }) {
  return (
    <main>
      <TenantHeader
        officeName="สำนักงานบัญชี สยามการบัญชี จำกัด"
        clientName="บริษัท อัลฟ่า เทคโนโลยี จำกัด"
        periodName="2026-10"
        userName="นักบัญชี ผู้ตรวจทาน"
        roleName="Office Manager / Reviewer"
      />
      <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 8px 0' }}>✂️ จัดกลุ่มหน้าเอกสาร (Page Grouping Manager)</h2>
        <p style={{ color: '#475569' }}>
          แยกไฟล์ PDF หลายหน้าออกเป็นเอกสารตรรกะ (Logical Documents) ย่อย หรือรวมหน้าที่เกี่ยวข้องกันเข้าด้วยกัน
        </p>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>ไฟล์ต้นฉบับ: multiserial_contract_and_invoices.pdf (รวม 3 หน้า)</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Logical Group 1 */}
            <div style={{ border: '2px solid #0284c7', borderRadius: '8px', padding: '16px', backgroundColor: '#f0f9ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, color: '#0369a1' }}>📄 เอกสารที่ 1: ใบแจ้งหนี้/ใบกำกับภาษี (Logical Doc #1)</h4>
                <span style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 600 }}>หน้าที่ 1, หน้าที่ 2</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 12px 0' }}>บทบาท: invoice, tax_invoice</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '80px', height: '110px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem' }}>หน้า 1</div>
                <div style={{ width: '80px', height: '110px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem' }}>หน้า 2</div>
              </div>
            </div>

            {/* Logical Group 2 */}
            <div style={{ border: '2px solid #16a34a', borderRadius: '8px', padding: '16px', backgroundColor: '#f0fdf4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, color: '#15803d' }}>📄 เอกสารที่ 2: สลิปหลักฐานการชำระเงิน (Logical Doc #2)</h4>
                <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>หน้าที่ 3</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 12px 0' }}>บทบาท: payment_evidence</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '80px', height: '110px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem' }}>หน้า 3</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#16a34a', fontWeight: 600 }}>[x] ตรวจสอบแล้ว: ครบถ้วน 3/3 หน้า ไม่พบหน้าตกหล่น</span>
            <button style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
              บันทึกการจัดกลุ่มหน้าเอกสาร
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
