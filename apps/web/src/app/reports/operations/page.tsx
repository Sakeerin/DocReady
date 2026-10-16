'use client';

import React from 'react';
import { computeOperationalMetrics, summarizeUsageLedger } from '@docready/domain';

export default function OperationalMetricsAndUsagePage() {
  const operations = computeOperationalMetrics({
    officeId: 'off_alpha',
    documents: [
      { status: 'reviewed', prepDurationSeconds: 74, hasException: false },
      { status: 'approved', prepDurationSeconds: 68, hasException: false },
      { status: 'reviewed', prepDurationSeconds: 95, hasException: true },
      { status: 'pending_review', hasException: false },
    ],
    missingRequests: [{ status: 'published' }, { status: 'resolved' }],
    packages: [{ status: 'approved' }, { status: 'invalidated_by_change' }],
  });

  const usageSummaries = summarizeUsageLedger([
    {
      id: 'u1',
      officeId: 'off_alpha',
      clientId: 'cli_alpha_1 (บจก. สยามเทรดดิ้ง)',
      metricType: 'ocr_pages',
      rawUnits: 120,
      billableUnits: 120,
      isSystemFaultReprocess: false,
      providerCostSatang: 6000,
      idempotencyKey: 'k1',
      createdAt: '2026-10-16T09:00:00Z',
    },
    {
      id: 'u2',
      officeId: 'off_alpha',
      clientId: 'cli_alpha_1 (บจก. สยามเทรดดิ้ง)',
      metricType: 'ocr_pages',
      rawUnits: 8,
      billableUnits: 0,
      isSystemFaultReprocess: true,
      providerCostSatang: 400,
      idempotencyKey: 'k2',
      createdAt: '2026-10-16T09:10:00Z',
    },
    {
      id: 'u3',
      officeId: 'off_alpha',
      clientId: 'cli_alpha_1 (บจก. สยามเทรดดิ้ง)',
      metricType: 'jev_input_tokens',
      rawUnits: 45200,
      billableUnits: 45200,
      isSystemFaultReprocess: false,
      providerCostSatang: 1350,
      idempotencyKey: 'k3',
      createdAt: '2026-10-16T09:20:00Z',
    },
  ]);

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
          รายงานผลการปฏิบัติงานและสมุดคุมโควตาการใช้งาน (Operations & Usage Ledger)
        </h1>
        <p style={{ color: '#475569', marginTop: '0.4rem' }}>
          แสดงตัวชี้วัดเวลาเตรียมเอกสาร อัตราข้อยกเว้น ขนาดกลุ่มตัวอย่าง (Sample Size:{' '}
          <strong>n = {operations.sampleSize}</strong>) และแยกหน่วยเรียกเก็บลูกค้าออกจากงาน Reprocess
          จากความผิดพลาดของระบบ (DR-705 & DR-706)
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '1rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
            เวลาเฉลี่ยต่อฉบับ (n = {operations.sampleSize})
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {operations.averagePrepTimeSeconds} วินาที
          </div>
        </div>
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '1rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>อัตราพบข้อยกเว้น (Exception Rate)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {operations.exceptionRatePercent}%
          </div>
        </div>
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '1rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>งานค้างตรวจ (Backlog)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {operations.backlogDocumentsCount} ฉบับ
          </div>
        </div>
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '1rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>คำขอเอกสารเพิ่ม (เปิดอยู่ / ปิดแล้ว)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
            {operations.openMissingRequestsCount} / {operations.resolvedMissingRequestsCount}
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>
          Usage & Cost Ledger แยกตามบริษัทลูกค้า (DR-705: แยกต้นทุนจริง vs หน่วยที่นับโควตาลูกค้า)
        </h2>
        {usageSummaries.map((client) => (
          <div
            key={client.clientId}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '1rem',
              marginTop: '1rem',
            }}
          >
            <h3 style={{ marginTop: 0 }}>{client.clientId}</h3>
            <p style={{ fontSize: '0.9rem', color: '#334155' }}>
              OCR Pages: ใช้งานจริงรวม <strong>{client.metrics.ocr_pages.rawUnits}</strong> หน้า |
              หักงาน Reprocess จากความผิดพลาดระบบ{' '}
              <strong>{client.metrics.ocr_pages.systemFaultReprocessUnits}</strong> หน้า |
              คิดเป็นโควตาลูกค้า (Billable):{' '}
              <strong>{client.metrics.ocr_pages.billableUnits}</strong> หน้า
            </p>
            <p style={{ fontSize: '0.9rem', color: '#334155', margin: 0 }}>
              Jev Input Tokens: <strong>{client.metrics.jev_input_tokens.billableUnits}</strong>{' '}
              tokens | ต้นทุนผู้ให้บริการสะสม:{' '}
              <strong>{(client.totalProviderCostSatang / 100).toFixed(2)} THB</strong>
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
