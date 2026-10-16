import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    system: 'DocReady Web API',
    timestamp: new Date().toISOString(),
    version: '1.0.0-s1',
  });
}
