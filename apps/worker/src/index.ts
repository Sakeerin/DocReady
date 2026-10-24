import { getOCRProvider, extractFieldCandidates } from '@docready/ocr';
import {
  evaluateKillSwitches,
  readKillSwitchesFromEnv,
  planOcrResume,
  resolveStaleOcrResult,
  redactDiagnosticText,
} from '@docready/domain';

/** Diagnostic logger: IDs/status/duration/error codes only; text is redacted (DR-804). */
function log(message: string): void {
  console.log(`[DocReady Worker] ${redactDiagnosticText(message)}`);
}

async function startWorker() {
  log('Initializing Multi-Provider OCR Background Processor...');

  const switches = evaluateKillSwitches(readKillSwitchesFromEnv(process.env));
  if (!switches.ocrEnabled) {
    log(`OCR kill switch active: intake continues, status=${switches.intakeStatus}`);
    return;
  }

  const activeProviderType = process.env.DOCREADY_OCR_PROVIDER || 'mock';
  log(`Active OCR Engine: ${activeProviderType}`);

  const ocrEngine = getOCRProvider(activeProviderType);

  // Simulate Outbox OCR Submit Event
  const samplePdfBuffer = Buffer.from('%PDF-1.4\n%...\n/Type /Page\n');

  log('Outbox Event received: submit_ocr_job for asset_001');

  // T-07: nothing persisted yet for this asset -> fresh submit (bounded attempts)
  const action = planOcrResume({ submitOutcomeUnknown: false, attempts: 0, maxAttempts: 3 });
  if (action !== 'resubmit') {
    log(`OCR plan: ${action}`);
    return;
  }

  const operation = await ocrEngine.submit({
    assetId: 'asset_001',
    fileBuffer: samplePdfBuffer,
    mimeType: 'application/pdf',
  });

  log(`OCR Checkpoint Saved: Operation ID = ${operation.operationId}, Provider = ${operation.provider}`);

  const ocrResult = await ocrEngine.poll(operation);
  log(`OCR Poll Complete: Spans count = ${ocrResult.spans.length}`);

  // T-08: never publish a result for a deleted/replaced asset
  const disposition = resolveStaleOcrResult({
    assetStatus: 'active',
    assetVersion: 1,
    resultVersion: 1,
  });
  if (disposition !== 'publish') {
    log(`OCR result disposition: ${disposition}`);
    return;
  }

  if (!switches.autoClassificationEnabled) {
    log('Auto-classification kill switch active: manual classification required');
  }

  const candidates = extractFieldCandidates(ocrResult.spans);
  log(`Candidate Extraction Complete: Extracted ${candidates.length} candidates`);

  log('Multi-Provider OCR Worker initialized and ready.');
}

if (require.main === module) {
  startWorker().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error(`[DocReady Worker] Fatal OCR worker error: ${redactDiagnosticText(message)}`);
    process.exit(1);
  });
}

export { startWorker };
