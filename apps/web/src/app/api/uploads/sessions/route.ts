import { NextResponse } from 'next/server';
import { CreateUploadSessionSchema } from '@docready/contracts';
import { checkFileQuotaLimits } from '@docready/domain';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = CreateUploadSessionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: ' Validation failed', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const { officeId, clientId, periodId, filename, mimeType, fileSize } = parseResult.data;

    // Check File Quota (20 MB ceiling check)
    const quotaCheck = checkFileQuotaLimits(fileSize, 1);
    if (!quotaCheck.valid) {
      return NextResponse.json({ error: quotaCheck.errorReason }, { status: 422 });
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const storageKey = `quarantine/${officeId}/${clientId}/${sessionId}_${filename}`;

    return NextResponse.json({
      sessionId,
      uploadUrl: `/api/mock-upload-endpoint/${sessionId}`,
      storageBucket: 'quarantine',
      storageKey,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
