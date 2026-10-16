import React from 'react';
import { TenantHeader } from '../../../components/TenantHeader';

export default function DocumentInboxPage() {
  return (
    <main>
      <TenantHeader
        officeName="สำนักงานบัญชี สยามการบัญชี จำกัด"
        clientName="บริษัท อัลฟ่า เทคโนโลยี จำกัด"
        periodName="2026-10"
        userName="นักบัญชี ผู้ตรวจทาน"
        roleName="Office Manager / Reviewer"
      />
      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 4px 0' }}>📥 คิวเอกสารรอการตรวจทาน (Document Review Inbox)</h2>
            <p style={{ color: '#475569', margin: 0 }}>รายการเอกสารในรอบงาน 2026-10 ของ บริษัท อัลฟ่า เทคโนโลยี จำกัด</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option>ทุกสถานะ (All Statuses)</option>
              <option>รอการตรวจ (needs_review)</option>
              <option>ตรวจแล้ว (reviewed)</option>
              <option>อ่านไม่ชัด (unreadable)</option>
            </select>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', fontSize: '0.875rem', color: '#475569' }}>
              <th style={{ padding: '12px 16px' }}>เลขที่เอกสาร</th>
              <th style={{ padding: '12px 16px' }}>บทบาทเอกสาร</th>
              <th style={{ padding: '12px 16px' }}>ผู้ขาย / คู่ค้า</th>
              <th style={{ padding: '12px 16px' }}>วันที่</th>
              <th style={{ padding: '12px 16px' }}>ยอดรวม (Grand Total)</th>
              <th style={{ padding: '12px 16px' }}>สถานะ</th>
              <th style={{ padding: '12px 16px' }}>การกระทำ</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '0.875rem' }}>
            <tr style={{ borderTop: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>INV-2026-0001</td>
              <td style={{ padding: '12px 16px' }}><span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>tax_invoice</span></td>
              <td style={{ padding: '12px 16px' }}>บริษัท สยาม ไอที เซอร์วิส จำกัด</td>
              <td style={{ padding: '12px 16px' }}>05/10/2026</td>
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>10,700.00 THB</td>
              <td style={{ padding: '12px 16px', color: '#d97706', fontWeight: 600 }}>[!] รอการตรวจ</td>
              <td style={{ padding: '12px 16px' }}>
                <a href="/documents/doc_001/review" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>เปิดตรวจทาน &rarr;</a>
              </td>
            </tr>
            <tr style={{ borderTop: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>REC-2569-0042</td>
              <td style={{ padding: '12px 16px' }}><span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>receipt</span></td>
              <td style={{ padding: '12px 16px' }}>ร้านค้าปลีกไอทีไทย</td>
              <td style={{ padding: '12px 16px' }}>01/10/2569 (BE)</td>
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>1,605.00 THB</td>
              <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 600 }}>[x] ยืนยันแล้ว</td>
              <td style={{ padding: '12px 16px' }}>
                <a href="/documents/doc_002/review" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>เปิดตรวจทาน &rarr;</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
