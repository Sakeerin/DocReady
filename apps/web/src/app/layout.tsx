import React from 'react';

export const metadata = {
  title: 'DocReady — ระบบเตรียมชุดเอกสารให้บัญชี',
  description: 'DocReady Document Preparation System for Accounting Firms',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}
