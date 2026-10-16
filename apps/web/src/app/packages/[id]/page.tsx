'use client';

import React, { useState } from 'react';
import { PackageItemSnapshot, PackageStatus } from '@docready/contracts';
import { aggregatePackageTotalsByCurrency } from '@docready/domain';

const INITIAL_ITEMS: PackageItemSnapshot[] = [
  {
    documentId: 'DOC-SYN-001',
    documentRevision: 2,
    documentNumber: '00045129',
    documentDate: '2026-10-03',
    sellerName: 'บริษัท สยาม ไอที เซอร์วิส จำกัด',
    sellerTaxId: '0105561001234',
    grandTotal: '10700.00',
    statedTax: '700.00',
    currency: 'THB',
    documentRoles: ['tax_invoice'],
    countingRole: 'primary_counting',
    sourceAssetId: 'asset_001',
    sourceHash: 'sha256_src_001',
    pageRange: '1-1',
    derivedStoragePath: 'derived/off_alpha/cli_alpha_1/DOC-SYN-001_p1-1_rev2.pdf',
    derivedFileHash: 'sha256_drv_001',
    hasMixedClientFlag: false,
  },
  {
    documentId: 'DOC-SYN-002',
    documentRevision: 1,
    documentNumber: 'RC-00045129',
    documentDate: '2026-10-04',
    sellerName: 'บริษัท สยาม ไอที เซอร์วิส จำกัด',
    sellerTaxId: '0105561001234',
    grandTotal: '10700.00',
    statedTax: '700.00',
    currency: 'THB',
    documentRoles: ['receipt'],
    countingRole: 'supporting_non_counting',
    sourceAssetId: 'asset_002',
    sourceHash: 'sha256_src_002',
    pageRange: '2-2',
    derivedStoragePath: 'derived/off_alpha/cli_alpha_1/DOC-SYN-002_p2-2_rev1.pdf',
    derivedFileHash: 'sha256_drv_002',
    hasMixedClientFlag: false,
  },
  {
    documentId: 'DOC-SYN-019',
    documentRevision: 1,
    documentNumber: 'INV-USD-0088',
    documentDate: '2026-10-09',
    sellerName: 'Global Cloud Infrastructure Inc.',
    sellerTaxId: '9900112233445',
    grandTotal: '250.00',
    statedTax: '0.00',
    currency: 'USD',
    documentRoles: ['invoice'],
    countingRole: 'primary_counting',
    sourceAssetId: 'asset_019',
    sourceHash: 'sha256_src_019',
    pageRange: '1-2',
    derivedStoragePath: 'derived/off_alpha/cli_alpha_1/DOC-SYN-019_p1-2_rev1.pdf',
    derivedFileHash: 'sha256_drv_019',
    hasMixedClientFlag: false,
  },
];

export default function PackageReviewAndExportPage({
  params,
}: {
  params: { id: string };
}) {
  const [status, setStatus] = useState<PackageStatus>('approved');
  const [exportChecksum, setExportChecksum] = useState<string | null>(
    '8f9d2a7e1c4b6a3f0e5d9c2b4a6f8e1d3c5b7a9f2e4d6c8b0a1f3e5d7c9b1a2f'
  );
  const totalsByCurrency = aggregatePackageTotalsByCurrency(INITIAL_ITEMS);

  const simulatePostApprovalEdit = () => {
    setStatus('invalidated_by_change');
    setExportChecksum(null);
  };

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
          ตรวจสอบและส่งออกชุดเอกสาร (Package Snapshot): {params.id}
        </h1>
        <p style={{ color: '#475569', marginTop: '0.5rem' }}>
          โหมดแพ็กเกจ: <strong>complete_against_defined_list</strong> | สถานะปัจจุบัน:{' '}
          <span
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: 4,
              backgroundColor: status === 'approved' ? '#dcfce7' : '#fee2e2',
              color: status === 'approved' ? '#166534' : '#991b1b',
              fontWeight: 600,
            }}
          >
            {status}
          </span>
        </p>
      </header>

      {status === 'invalidated_by_change' && (
        <div
          role="alert"
          style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: 8,
            color: '#991b1b',
          }}
        >
          <strong>การอนุมัติเดิมถูกยกเลิกอัตโนมัติ (T-21 Invariant):</strong>{' '}
          ตรวจพบการแก้ไขข้อมูลเอกสารหรือรายการคาดหวังหลังการอนุมัติ ระบบยังคงเก็บ Snapshot เดิมไว้เพื่อการ
          Audit แต่ไม่อนุญาตให้สั่งสร้างไฟล์ส่งออกใหม่จนกว่าจะสร้างและอนุมัติ Package Revision ใหม่
        </div>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {totalsByCurrency.map((summary) => (
          <div
            key={summary.currency}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '1rem',
              backgroundColor: '#f8fafc',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0' }}>
              สรุปยอดแยกตามสกุลเงิน: {summary.currency} (T-28)
            </h3>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
              เอกสารนับยอดหลัก (Primary): <strong>{summary.primaryDocumentCount}</strong> ฉบับ
            </p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
              เอกสารแนบประกอบไม่นับยอดซ้ำ (Supporting):{' '}
              <strong>{summary.supportingDocumentCount}</strong> ฉบับ
            </p>
            <p style={{ margin: '0.25rem 0', fontSize: '1rem' }}>
              ยอดรวมสุทธิ: <strong>{summary.grandTotalSum}</strong> {summary.currency} (ภาษี:{' '}
              {summary.statedTaxSum})
            </p>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem' }}>รายการเอกสารใน Snapshot (Immutable Package Items)</h2>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.9rem',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '0.6rem', borderBottom: '1px solid #cbd5e1' }}>รหัสเอกสาร / Rev</th>
              <th style={{ padding: '0.6rem', borderBottom: '1px solid #cbd5e1' }}>เลขที่เอกสาร (String)</th>
              <th style={{ padding: '0.6rem', borderBottom: '1px solid #cbd5e1' }}>ผู้ขาย / เลขผู้เสียภาษี</th>
              <th style={{ padding: '0.6rem', borderBottom: '1px solid #cbd5e1' }}>บทบาท / การนับยอด (T-17)</th>
              <th style={{ padding: '0.6rem', borderBottom: '1px solid #cbd5e1' }}>ไฟล์แยกหน้า (Split Derived)</th>
              <th style={{ padding: '0.6rem', borderBottom: '1px solid #cbd5e1' }}>ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_ITEMS.map((item) => (
              <tr key={item.documentId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.6rem' }}>
                  {item.documentId} (v{item.documentRevision})
                </td>
                <td style={{ padding: '0.6rem', fontFamily: 'monospace' }}>{item.documentNumber}</td>
                <td style={{ padding: '0.6rem' }}>
                  {item.sellerName}
                  <br />
                  <small style={{ color: '#64748b', fontFamily: 'monospace' }}>
                    TAX ID: {item.sellerTaxId}
                  </small>
                </td>
                <td style={{ padding: '0.6rem' }}>
                  {item.documentRoles.join(', ')} / <strong>{item.countingRole}</strong>
                </td>
                <td style={{ padding: '0.6rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  p.{item.pageRange} ({item.derivedStoragePath})
                </td>
                <td style={{ padding: '0.6rem', fontFamily: 'monospace' }}>
                  {item.grandTotal} {item.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          type="button"
          disabled={status !== 'approved'}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: status === 'approved' ? '#0f172a' : '#94a3b8',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: status === 'approved' ? 'pointer' : 'not-allowed',
          }}
        >
          ส่งออก XLSX (5 ชีต) + Split PDF + Manifest ZIP
        </button>
        <button
          type="button"
          onClick={simulatePostApprovalEdit}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#fff',
            color: '#b91c1c',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          จำลองการแก้ไขเอกสารหลังอนุมัติ (ทดสอบ T-21)
        </button>
      </div>

      {exportChecksum && (
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#334155', fontFamily: 'monospace' }}>
          SHA-256 Checksum ล่าสุด: {exportChecksum}
        </p>
      )}
    </main>
  );
}
