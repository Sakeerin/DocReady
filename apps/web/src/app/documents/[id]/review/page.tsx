'use client';

import React, { useState } from 'react';
import { TenantHeader } from '../../../../components/TenantHeader';
import { EvidenceHighlightOverlay } from '../../../../components/EvidenceHighlightOverlay';
import { DuplicateCandidateBanner } from '../../../../components/DuplicateCandidateBanner';

export default function DocumentReviewPage({ params }: { params: { id: string } }) {
  const [activeField, setActiveField] = useState<string | null>('grand_total');
  const [currentRevision] = useState<number>(1);
  const [duplicateCandidates, setDuplicateCandidates] = useState([
    {
      documentId: 'doc_dup_008',
      documentNumber: 'INV-2026-0001',
      matchReasons: ['เลขที่เอกสารตรงกัน (INV-2026-0001)', 'ยอดเงินรวมตรงกัน (10,700.00 THB)'],
      score: 0.9,
    },
  ]);

  const handleLinkSupporting = (targetId: string) => {
    alert(`สร้างความเชื่อมโยงเป็นเอกสารประกอบ (Supports) กับเอกสาร ID ${targetId} สำเร็จ`);
    setDuplicateCandidates([]);
  };

  const handleConfirmDuplicate = (targetId: string) => {
    alert(`ยืนยันว่าเป็นเอกสารซ้ำ (Duplicate) กับเอกสาร ID ${targetId}`);
    setDuplicateCandidates([]);
  };

  const sampleBoundingBoxes = [
    {
      id: 'document_number',
      label: 'เลขที่เอกสาร',
      box: { x: 0.72, y: 0.08, width: 0.22, height: 0.03 },
      isActive: activeField === 'document_number',
    },
    {
      id: 'document_date',
      label: 'วันที่เอกสาร',
      box: { x: 0.72, y: 0.11, width: 0.18, height: 0.03 },
      isActive: activeField === 'document_date',
    },
    {
      id: 'seller_name',
      label: 'ผู้ขาย',
      box: { x: 0.08, y: 0.05, width: 0.4, height: 0.04 },
      isActive: activeField === 'seller_name',
    },
    {
      id: 'seller_tax_id',
      label: 'เลขภาษีผู้ขาย',
      box: { x: 0.08, y: 0.1, width: 0.25, height: 0.03 },
      isActive: activeField === 'seller_tax_id',
    },
    {
      id: 'grand_total',
      label: 'ยอดรวม (Grand Total)',
      box: { x: 0.7, y: 0.82, width: 0.22, height: 0.04 },
      isActive: activeField === 'grand_total',
    },
  ];

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TenantHeader
        officeName="สำนักงานบัญชี สยามการบัญชี จำกัด"
        clientName="บริษัท อัลฟ่า เทคโนโลยี จำกัด"
        periodName="2026-10"
        userName="นักบัญชี ผู้ตรวจทาน"
        roleName="Office Manager / Reviewer"
      />

      {/* Subheader Toolbar */}
      <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
        <div>
          <span>เอกสาร ID: <strong>{params.id}</strong></span>
          <span style={{ margin: '0 12px', color: '#64748b' }}>|</span>
          <span>เวอร์ชัน: <strong style={{ color: '#f59e0b' }}>Revision {currentRevision}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a href={`/documents/${params.id}/pages`} style={{ color: '#38bdf8', textDecoration: 'none' }}>✂️ จัดกลุ่มหน้า (Split/Merge)</a>
          <button style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '4px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
            [Ctrl + Enter] ยืนยันข้อมูล (Revision {currentRevision})
          </button>
        </div>
      </div>

      {/* Side-by-Side Review Grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 450px', overflow: 'hidden' }}>
        {/* Left Side: Document Viewer + Interactive Highlight Overlay */}
        <div style={{ backgroundColor: '#334155', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto' }}>
          
          {/* Duplicate Candidates Alert Banner */}
          <div style={{ width: '595px' }}>
            <DuplicateCandidateBanner
              candidates={duplicateCandidates}
              onLinkSupporting={handleLinkSupporting}
              onConfirmDuplicate={handleConfirmDuplicate}
            />
          </div>

          <div style={{ backgroundColor: '#fff', width: '595px', height: '842px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', padding: '40px', boxSizing: 'border-box', position: 'relative' }}>
            
            {/* Live Highlight Overlay */}
            <EvidenceHighlightOverlay
              boundingBoxes={sampleBoundingBoxes}
              imageWidth={595}
              imageHeight={842}
            />

            <div style={{ borderBottom: '2px solid #000', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>บริษัท สยาม ไอที เซอร์วิส จำกัด</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#444' }}>เลขประจำตัวผู้เสียภาษี: 0105558001111 (สาขา 00000)</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: 0, color: '#0284c7' }}>ใบกำกับภาษี / ใบเสร็จรับเงิน</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>เลขที่: <strong>INV-2026-0001</strong></p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem' }}>วันที่: 05/10/2026</p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '40px', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>รายการ</th>
                  <th style={{ textAlign: 'right', padding: '8px 0' }}>จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0' }}>ค่าบริการระบบคลาวด์ ประจำเดือน 10/2026</td>
                  <td style={{ textAlign: 'right', padding: '8px 0' }}>10,000.00</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '100px', borderTop: '1px solid #ddd', paddingTop: '16px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>จำนวนเงินก่อนภาษี (Subtotal):</span>
                <span>10,000.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                <span>700.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontWeight: 'bold', fontSize: '1rem', color: '#000', backgroundColor: '#fef08a', padding: '4px 8px', borderRadius: '4px' }}>
                <span>จำนวนเงินรวมทั้งสิ้น (Grand Total):</span>
                <span>10,700.00 THB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Field Form Editor */}
        <div style={{ backgroundColor: '#fff', borderLeft: '1px solid #e2e8f0', padding: '24px', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#0f172a' }}>✏️ ตรวจสอบและยืนยันข้อมูล (Field Editor)</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div onFocus={() => setActiveField('document_number')}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                เลขที่เอกสาร (Document Number):
              </label>
              <input
                type="text"
                defaultValue="INV-2026-0001"
                style={{ width: '100%', padding: '8px 12px', border: activeField === 'document_number' ? '2px solid #0284c7' : '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div onFocus={() => setActiveField('document_date')}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                วันที่เอกสาร (Document Date):
              </label>
              <input
                type="text"
                defaultValue="2026-10-05"
                style={{ width: '100%', padding: '8px 12px', border: activeField === 'document_date' ? '2px solid #0284c7' : '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div onFocus={() => setActiveField('seller_name')}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                ชื่อผู้ขาย / คู่ค้า (Seller Name):
              </label>
              <input
                type="text"
                defaultValue="บริษัท สยาม ไอที เซอร์วิส จำกัด"
                style={{ width: '100%', padding: '8px 12px', border: activeField === 'seller_name' ? '2px solid #0284c7' : '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div onFocus={() => setActiveField('seller_tax_id')}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                เลขผู้เสียภาษีผู้ขาย (Seller Tax ID):
              </label>
              <input
                type="text"
                defaultValue="0105558001111"
                style={{ width: '100%', padding: '8px 12px', border: activeField === 'seller_tax_id' ? '2px solid #0284c7' : '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div onFocus={() => setActiveField('grand_total')}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                ยอดเงินรวม (Grand Total):
              </label>
              <input
                type="text"
                defaultValue="10700.00"
                style={{ width: '100%', padding: '8px 12px', border: activeField === 'grand_total' ? '2px solid #0284c7' : '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button style={{ flex: 1, padding: '12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                กดยืนยัน (Confirm)
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
