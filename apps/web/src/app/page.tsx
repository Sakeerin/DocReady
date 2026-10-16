import React from 'react';
import { TenantHeader } from '../components/TenantHeader';

export default function HomePage() {
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
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>ยินดีต้อนรับสู่ DocReady Workspace</h2>
        <p style={{ color: '#475569' }}>
          ระบบช่วยเหลือการสกัดข้อมูล ตรวจสอบหลักฐาน และจัดชุดส่งออกเอกสารสำหรับสำนักงานบัญชี (S0 - S1 Foundation Ready)
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '24px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>📥 คิวเอกสารรับเข้า (Inbox)</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>ไฟล์ใน Quarantine และไฟล์รอการตรวจทานข้อมูล</p>
          </div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>📋 ตรวจสอบรายการคาดหวัง (Checklist)</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>ตรวจความครบถ้วนของเอกสารประจำรอบงาน</p>
          </div>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>📦 แพ็กเกจส่งออก (Export Bundles)</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>อนุมัติและดาวน์โหลด XLSX + ZIP snapshot</p>
          </div>
        </div>
      </div>
    </main>
  );
}
