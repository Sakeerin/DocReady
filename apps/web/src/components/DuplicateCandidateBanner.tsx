import React from 'react';

interface DuplicateCandidateBannerProps {
  candidates: Array<{
    documentId: string;
    documentNumber?: string;
    matchReasons: string[];
    score: number;
  }>;
  onLinkSupporting: (targetId: string) => void;
  onConfirmDuplicate: (targetId: string) => void;
}

export function DuplicateCandidateBanner({
  candidates,
  onLinkSupporting,
  onConfirmDuplicate,
}: DuplicateCandidateBannerProps) {
  if (candidates.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 600, fontSize: '0.95rem' }}>
        <span>⚠️ พบเอกสารที่อาจเกี่ยวข้องกันในระบบ (Possible Matching Documents)</span>
      </div>
      <p style={{ margin: '4px 0 12px 0', fontSize: '0.85rem', color: '#78350f' }}>
        ระบบตรวจพบเอกสารในรอบงานนี้ที่มีข้อมูลสอดคล้องกัน (โปรดเลือกสร้างความเชื่อมโยงแทนการลบไฟล์):
      </p>

      {candidates.map((cand) => (
        <div
          key={cand.documentId}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fef3c7',
            borderRadius: '6px',
            padding: '12px',
            marginTop: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
              📄 เอกสารคู่เทียบ: {cand.documentNumber || cand.documentId}
            </span>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              เหตุผล: {cand.matchReasons.join(', ')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onLinkSupporting(cand.documentId)}
              style={{
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔗 ผูกเป็นเอกสารประกอบ (Supports)
            </button>
            <button
              onClick={() => onConfirmDuplicate(cand.documentId)}
              style={{
                backgroundColor: '#d97706',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📑 ยืนยันเอกสารซ้ำ (Duplicate)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
