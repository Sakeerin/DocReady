import React from 'react';

interface TenantHeaderProps {
  officeName: string;
  clientName: string;
  periodName: string;
  userName: string;
  roleName: string;
}

export function TenantHeader({
  officeName,
  clientName,
  periodName,
  userName,
  roleName,
}: TenantHeaderProps) {
  return (
    <header style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>DocReady</h1>
        <div style={{ fontSize: '0.875rem', background: '#1e293b', padding: '4px 12px', borderRadius: '6px', border: '1px solid #334155' }}>
          <span>🏢 <strong>{officeName}</strong></span>
          <span style={{ margin: '0 8px', color: '#64748b' }}>/</span>
          <span>🏢 <strong>{clientName}</strong></span>
          <span style={{ margin: '0 8px', color: '#64748b' }}>/</span>
          <span>📅 รอบ <strong>{periodName}</strong></span>
        </div>
      </div>
      <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
        <span>👤 {userName}</span>
        <span style={{ marginLeft: '8px', background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>{roleName}</span>
      </div>
    </header>
  );
}
