'use client';

import React, { useState } from 'react';
import { TenantHeader } from '../../components/TenantHeader';
import { MissingRequestStatus } from '@docready/contracts';

interface StaffMissingRequestItem {
  id: string;
  title: string;
  publicMessage: string;
  internalNote: string;
  status: MissingRequestStatus;
  clientResponseText?: string;
  resolutionNote?: string;
}

export default function MissingRequestsPage() {
  const [requests, setRequests] = useState<StaffMissingRequestItem[]>([
    {
      id: 'mreq_001',
      title: 'ขอใบแจ้งหนี้/ใบเสร็จ ค่าเช่าสำนักงานประจำเดือน 10/2026',
      publicMessage: 'รบกวนส่งใบเสร็จรับเงิน/ใบกำกับภาษีค่าเช่าอาคารประจำเดือนตุลาคม 2026 ด้วยครับ',
      internalNote: 'ติดต่อคุณสมชายฝ่ายอาคาร โทร 02-xxx-xxxx',
      status: 'responded',
      clientResponseText: 'ลูกค้าตอบกลับ: แนบไฟล์ CONTRACT-INV-88.pdf มาให้แล้วครับ',
    },
    {
      id: 'mreq_002',
      title: 'ขอเอกสารใบกำกับภาษีฉบับเต็ม (แทนใบเสร็จย่อร้านกาแฟ)',
      publicMessage: 'เอกสาร POS-88412 จางมาก รบกวนถ่ายภาพใหม่หรือขอใบกำกับภาษีเต็มรูปครับ',
      internalNote: 'ร่างไว้ก่อน รอถามผู้จัดการว่าจะตัดเป็นรายจ่ายต้องห้ามหรือไม่',
      status: 'draft',
    },
  ]);

  const handlePublish = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'published' } : r))
    );
  };

  const handleResolve = (id: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'resolved',
              resolutionNote: 'นักบัญชีตรวจเอกสารที่ลูกค้าส่งมาแล้ว ตรงตามรายการค่าเช่าประจำเดือน',
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
        userName="นักบัญชี ผู้ตรวจทาน"
        roleName="Office Manager / Reviewer"
      />
      <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 8px 0' }}>
          📨 จัดการคำขอเอกสารที่ขาด (Missing Document Requests)
        </h2>
        <p style={{ color: '#475569', marginBottom: '24px' }}>
          แยกสถานะ Draft (ภายในสำนักงาน) ออกจาก Published (แสดงใน Client Portal) และการตอบกลับของลูกค้าจะต้องผ่านการตรวจรับรองจากนักบัญชีก่อนปิดงานเสมอ (T-23)
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {requests.map((req) => (
            <div
              key={req.id}
              style={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      marginRight: '10px',
                      backgroundColor:
                        req.status === 'resolved'
                          ? '#dcfce7'
                          : req.status === 'responded'
                          ? '#fef3c7'
                          : req.status === 'published'
                          ? '#e0f2fe'
                          : '#f1f5f9',
                      color:
                        req.status === 'resolved'
                          ? '#166534'
                          : req.status === 'responded'
                          ? '#b45309'
                          : req.status === 'published'
                          ? '#0369a1'
                          : '#475569',
                    }}
                  >
                    STATUS: {req.status.toUpperCase()}
                  </span>
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{req.title}</strong>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {req.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(req.id)}
                      style={{
                        backgroundColor: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      📢 เผยแพร่ไปยัง Client Portal (Publish)
                    </button>
                  )}
                  {req.status === 'responded' && (
                    <button
                      onClick={() => handleResolve(req.id)}
                      style={{
                        backgroundColor: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      [x] ตรวจแล้วและปิดคำขอ (Verify & Resolve)
                    </button>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '0.9rem', color: '#334155', marginBottom: '8px' }}>
                <strong>ข้อความที่แสดงให้ลูกค้าเห็น (Public Message):</strong> {req.publicMessage}
              </div>

              <div
                style={{
                  fontSize: '0.85rem',
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  borderLeft: '3px solid #94a3b8',
                }}
              >
                🔒 <strong>บันทึกภายในสำนักงานบัญชี (Internal Staff Note — ลูกค้าไม่เห็น):</strong> {req.internalNote}
              </div>

              {req.clientResponseText && (
                <div
                  style={{
                    marginTop: '12px',
                    fontSize: '0.875rem',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde047',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    color: '#854d0e',
                  }}
                >
                  💬 <strong>{req.clientResponseText}</strong> (สถานะยังเป็น <code>responded</code> จนกว่าผู้ตรวจจะกดยืนยัน)
                </div>
              )}

              {req.resolutionNote && (
                <div
                  style={{
                    marginTop: '12px',
                    fontSize: '0.875rem',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #86efac',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    color: '#166534',
                  }}
                >
                  ✅ <strong>บันทึกการปิดคำขอโดยนักบัญชี:</strong> {req.resolutionNote}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
