import { NextResponse } from 'next/server';
import { PilotMetricsRequestSchema } from '@docready/contracts';
import { computePilotMetrics } from '@docready/domain';

const BodySchema = PilotMetricsRequestSchema;

/** Pure computation endpoint: no data is fabricated; empty input yields insufficient_sample. */
export async function GET() {
  return NextResponse.json(computePilotMetrics({ events: [] }));
}

export async function POST(request: Request) {
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid pilot metrics DTO', details: parsed.error.format() },
        { status: 422 }
      );
    }
    return NextResponse.json(
      computePilotMetrics({ events: parsed.data.events, minDocuments: parsed.data.minDocuments })
    );
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
