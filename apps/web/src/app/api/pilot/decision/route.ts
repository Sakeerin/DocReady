import { NextResponse } from 'next/server';
import { PilotDecisionRequestSchema } from '@docready/contracts';
import { evaluatePilotDecision } from '@docready/domain';

const BodySchema = PilotDecisionRequestSchema;

export async function POST(request: Request) {
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid pilot decision DTO', details: parsed.error.format() },
        { status: 422 }
      );
    }
    return NextResponse.json(evaluatePilotDecision(parsed.data));
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
