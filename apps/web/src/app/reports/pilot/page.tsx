import React from 'react';
import { computePilotMetrics, evaluatePilotDecision } from '@docready/domain';

/**
 * Pilot results page. It shows only real recorded data; with none recorded it states that the
 * sample is insufficient instead of displaying placeholder numbers.
 */
export default function PilotReportPage() {
  const metrics = computePilotMetrics({ events: [] });
  const decision = evaluatePilotDecision({
    workingDays: 0,
    sampleSizeOk: metrics.status === 'ok',
    accountingCycleClosed: false,
    timeReductionPercent: metrics.timeReductionPercent ?? null,
    reworkWorseThanBaseline: metrics.reworkWorseThanBaseline ?? null,
  });

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem' }}>ผลการทดลองใช้งานจริง (Pilot)</h1>
      {metrics.status === 'insufficient_sample' ? (
        <div role="status" style={{ padding: '1rem', border: '1px solid #f59e0b', borderRadius: 8 }}>
          <strong>ข้อมูลไม่พอ:</strong> ตัวอย่างปัจจุบัน {metrics.sampleSize} เอกสาร (ต้องมีอย่างน้อย{' '}
          {metrics.minDocuments} เอกสารต่อโหมด ทั้ง baseline และ assisted) ยังไม่แสดงตัวเลขสรุป
        </div>
      ) : null}
      <p style={{ marginTop: '1rem' }}>
        การตัดสินใจปัจจุบัน: <strong>{decision.decision}</strong> — {decision.reason}
      </p>
    </main>
  );
}
