'use client';

import React, { useState } from 'react';
import { TenantHeader } from '../../../../../components/TenantHeader';
import { computePeriodReadiness, ExpectedItemSummary, ExpectedMatchSummary } from '@docready/domain';

export default function PeriodChecklistPage({
  params,
}: {
  params: { id: string; periodId: string };
}) {
  const [hasExpectedList, setHasExpectedList] = useState<boolean>(true);
  const [expectedItems] = useState<ExpectedItemSummary[]>([
    {
      id: 'exp_001',
      title: 'ค่าเช่าสำนักงานประจำเดือน 10/2026',
      vendorName: 'บริษัท อาคารพาณิชย์และบริการ จำกัด',
      expectedAmount: '48150.00',
      requirementStatus: 'required',
    },
    {
      id: 'exp_002',
      title: 'ค่าบริการอินเทอร์เน็ตองค์กร',
      vendorName: 'บริษัท โทรคมนาคมไทย จำกัด (มหาชน)',
      expectedAmount: '3199.30',
      requirementStatus: 'required',
    },
    {
      id: 'exp_003',
      title: 'ค่าบริการ Cloud Server',
      vendorName: 'บริษัท สยาม ไอที เซอร์วิส จำกัด',
      expectedAmount: '10700.00',
      requirementStatus: 'required',
    },
  ]);

  const [matches, setMatches] = useState<ExpectedMatchSummary[]>([
    { expectedItemId: 'exp_002', documentId: 'DOC-SYN-006 (TR-2026-1089)' },
    { expectedItemId: 'exp_003', documentId: 'DOC-SYN-001 (INV-2026-0001)' },
  ]);

  const activeItems = hasExpectedList ? expectedItems : [];
  const readiness = computePeriodReadiness(activeItems, matches, 3, false);

  const handleMatchRemaining = () => {
    setMatches([
      ...matches,
      { expectedItemId: 'exp_001', documentId: 'DOC-SYN-010 (CONTRACT-INV-88)' },
    ]);
  };

  const bannerStyles: Record<string, { bg: string; border: string; color: string; badge: string }> = {
    complete_against_defined_list: {
      bg: '#f0fdf4',
      border: '#86efac',
      color: '#166534',
      badge: 'COMPLETE AGAINST DEFINED LIST',
    },
    received_documents_with_exceptions: {
      bg: '#fffbeb',
      border: '#fde047',
      color: '#854d0e',
      badge: 'RECEIVED WITH EXCEPTIONS',
    },
    received_only: {
      bg: '#f1f5f9',
      border: '#cbd5e1',
      color: '#334155',
      badge: 'RECEIVED ONLY (NO EXPECTED LIST)',
    },
  };

  const style = bannerStyles[readiness.coverageBasis]!;

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 4px 0' }}>
              📋 ความครบถ้วนของเอกสารประจำรอบงาน (Checklist & Expected Items)
            </h2>
            <p style={{ color: '#475569', margin: 0 }}>
              Client ID: {params.id} | Period ID: {params.periodId}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setHasExpectedList(!hasExpectedList)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#e2e8f0',
                color: '#1e293b',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              สลับโหมดทดสอบ: {hasExpectedList ? 'มี Expected List' : 'ไม่มี Expected List (T-22)'}
            </button>
            <a
              href="/requests"
              style={{
                padding: '8px 16px',
                backgroundColor: '#0284c7',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '6px',
                fontWeight: 600,
              }}
            >
              📨 จัดการคำขอเอกสารขาด (Missing Requests)
            </a>
          </div>
        </div>

        {/* Coverage Basis Status Banner (DR-606 / T-22) */}
        <div
          style={{
            backgroundColor: style.bg,
            border: `2px solid ${style.border}`,
            color: style.color,
            padding: '16px 20px',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span
                style={{
                  backgroundColor: style.color,
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                coverage_basis = {readiness.coverageBasis}
              </span>
              <strong>{style.badge}</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{readiness.bannerMessage}</p>
          </div>
          {hasExpectedList && readiness.missingRequiredIds.length > 0 && (
            <button
              onClick={handleMatchRemaining}
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
              🔗 ยืนยันจับคู่เอกสารค่าเช่า (Match DOC-SYN-010)
            </button>
          )}
        </div>

        {/* Expected Items Table */}
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>รายการเอกสารที่คาดหวังประจำเดือน (Expected Items Register)</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              จับคู่แล้ว {readiness.matchedRequiredCount} / {readiness.requiredCount} รายการบังคับ
            </span>
          </div>

          {!hasExpectedList ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
              ยังไม่ได้กำหนดรายการที่คาดหวัง (Expected Items) สำหรับรอบงานนี้ ระบบจึงแสดงสถานะเป็น <strong>received_only</strong> และไม่อนุญาตให้แสดงป้ายว่าเอกสารครบทั้งหมด
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>รายการที่คาดหวัง</th>
                  <th style={{ padding: '12px 16px' }}>ผู้ขาย / คู่ค้า</th>
                  <th style={{ padding: '12px 16px' }}>ยอดประมาณการ</th>
                  <th style={{ padding: '12px 16px' }}>เงื่อนไข</th>
                  <th style={{ padding: '12px 16px' }}>เอกสารที่จับคู่ (Matched Doc)</th>
                  <th style={{ padding: '12px 16px' }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {expectedItems.map((item) => {
                  const match = matches.find((m) => m.expectedItemId === item.id);
                  return (
                    <tr key={item.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.title}</td>
                      <td style={{ padding: '12px 16px' }}>{item.vendorName}</td>
                      <td style={{ padding: '12px 16px' }}>{item.expectedAmount} THB</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {item.requirementStatus}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {match ? (
                          <strong style={{ color: '#0284c7' }}>📄 {match.documentId}</strong>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>— ยังไม่มีเอกสารจับคู่ —</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: match ? '#16a34a' : '#dc2626' }}>
                        {match ? '[x] จับคู่แล้ว' : '[!] ขาดเอกสาร'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
