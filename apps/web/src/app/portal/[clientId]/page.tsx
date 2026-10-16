'use client';

import React, { useState } from 'react';
import { TenantHeader } from '../../../components/TenantHeader';

export default function ClientPortalPage({ params }: { params: { clientId: string } }) {
  const [publishedRequests, setPublishedRequests] = useState([
    {
      id: 'mreq_001',
      title: 'ขอใบแจ้งหนี้/ใบเสร็จ ค่าเช่าสำนักงานประจำเดือน 10/2026',
      publicMessage: 'รบกวนส่งใบเสร็จรับเงิน/ใบกำกับภาษีค่าเช่าอาคารประจำเดือนตุลาคม 2026 ด้วยครับ',
      status: 'published',
      responseSummary: '',
    },
  ]);

  const handleRespondUpload = (id: string) => {
    setPublishedRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'responded',
              responseSummary: 'ส่งไฟล์เพิ่มเติมแล้ว (รอนักบัญชีตรวจสอบเพื่อยืนยันปิดคำขอ)',
            }
          : r
      )
    );
  };

  const handleRespondNoTransaction = (id: string) => {
    setPublishedRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'responded',
              responseSummary: 'แจ้งว่า "เดือนนี้ไม่มีรายการ" แล้ว (รอนักบัญชีตรวจสอบเพื่อปรับสถานะ)',
            }
          : r
      )
    );
  };

  return (
    <main>
      <TenantHeader
        officeName="สำนักงานบัญชี สยามการบัญชี จำกัด"
        clientName="บริษัท อัลฟ่า เทคโนโลยี จำกัด"
        periodName="2026-10"
        userName="ผู้ส่งเอกสารลูกค้า (Client Admin)"
        roleName="Client Admin"
      />
      <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>📤 ช่องทางส่งไฟล์เอกสารและตอบคำขอ (Client Upload Portal)</h2>
        <p style={{ color: '#475569' }}>
          อัปโหลดไฟล์ใบแจ้งหนี้ ใบเสร็จรับเงิน หรือตอบคำขอเอกสารเพิ่มเติมสำหรับรอบงานประจำเดือน (สูงสุด 20 MB/ไฟล์, 30 หน้า/PDF)
        </p>

        {/* Published Missing Requests Section (DR-604 & DR-605) */}
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '10px',
            padding: '20px',
            marginTop: '20px',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: '#92400e' }}>
            🔔 รายการเอกสารที่สำนักงานบัญชีขอเพิ่มเติม (Missing Document Requests)
          </h3>

          {publishedRequests.map((req) => (
            <div
              key={req.id}
              style={{
                backgroundColor: '#fff',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#1e293b' }}>{req.title}</strong>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: req.status === 'responded' ? '#fef3c7' : '#e0f2fe',
                    color: req.status === 'responded' ? '#b45309' : '#0369a1',
                  }}
                >
                  {req.status === 'responded' ? 'ส่งคำตอบแล้ว รอนักบัญชีตรวจ' : 'รอการส่งเอกสาร'}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#475569', margin: '8px 0 12px 0' }}>
                {req.publicMessage}
              </p>

              {req.responseSummary ? (
                <div style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 600 }}>
                  [!] {req.responseSummary}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleRespondUpload(req.id)}
                    style={{
                      backgroundColor: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    📎 อัปโหลดไฟล์ตอบคำขอนี้
                  </button>
                  <button
                    onClick={() => handleRespondNoTransaction(req.id)}
                    style={{
                      backgroundColor: '#64748b',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    💬 แจ้งว่า &ldquo;เดือนนี้ไม่มีรายการ&rdquo;
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ border: '2px dashed #94a3b8', borderRadius: '12px', padding: '40px', textAlign: 'center', backgroundColor: '#fff', marginTop: '24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📁</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: '#1e293b' }}>ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>รองรับไฟล์ PDF, JPEG, PNG</p>
          <button style={{ marginTop: '16px', padding: '10px 24px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
            เลือกไฟล์จากเครื่อง
          </button>
        </div>

        <div style={{ marginTop: '32px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>รายการไฟล์ที่ส่งแล้วในรอบนี้ (Upload Receipts)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', fontSize: '0.875rem' }}>
                <th style={{ padding: '12px 16px' }}>ชื่อไฟล์</th>
                <th style={{ padding: '12px 16px' }}>ขนาด</th>
                <th style={{ padding: '12px 16px' }}>สถานะ</th>
                <th style={{ padding: '12px 16px' }}>เวลาส่ง</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.875rem' }}>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 16px' }}>syn_tax_inv_001.pdf</td>
                <td style={{ padding: '12px 16px' }}>1.2 MB</td>
                <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 600 }}>[x] สแกนปลอดภัยแล้ว</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>05/10/2026 14:20</td>
              </tr>
              <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 16px' }}>syn_receipt_be_002.pdf</td>
                <td style={{ padding: '12px 16px' }}>850 KB</td>
                <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 600 }}>[x] สแกนปลอดภัยแล้ว</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>05/10/2026 14:22</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
