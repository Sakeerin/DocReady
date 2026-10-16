import { NextResponse } from 'next/server';
import { CreateMissingRequestSchema } from '@docready/contracts';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const audience = url.searchParams.get('audience') || 'office_staff';

    const allRequests = [
      {
        id: 'mreq_001',
        title: 'ขอใบแจ้งหนี้/ใบเสร็จ ค่าเช่าสำนักงานประจำเดือน 10/2026',
        publicMessage: 'รบกวนส่งใบเสร็จรับเงิน/ใบกำกับภาษีค่าเช่าอาคารประจำเดือนตุลาคม 2026 ด้วยครับ',
        internalNote: 'ติดต่อคุณสมชายฝ่ายอาคาร โทร 02-xxx-xxxx',
        status: 'published',
        expectedItemId: 'exp_001',
      },
      {
        id: 'mreq_002',
        title: 'ขอเอกสารใบกำกับภาษีฉบับเต็ม (แทนใบเสร็จย่อร้านกาแฟ)',
        publicMessage: 'เอกสาร POS-88412 จางมาก รบกวนถ่ายภาพใหม่หรือขอใบกำกับภาษีเต็มรูปครับ',
        internalNote: 'รอถามผู้จัดการฝ่ายบัญชีว่าจะตัดเป็นค่าใช้จ่ายต้องห้ามหรือไม่',
        status: 'draft',
      },
    ];

    if (audience === 'client_user') {
      const clientVisible = allRequests
        .filter((r) => r.status !== 'draft')
        .map(({ internalNote, ...rest }) => rest);

      return NextResponse.json({ requests: clientVisible });
    }

    return NextResponse.json({ requests: allRequests });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = CreateMissingRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid missing request DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    return NextResponse.json({
      status: 'draft',
      request: {
        id: `mreq_${Date.now()}`,
        ...parseResult.data,
        status: 'draft',
      },
      message: 'Draft missing document request created (hidden from client until published).',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
