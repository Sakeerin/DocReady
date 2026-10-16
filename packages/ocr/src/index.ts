import { OcrProviderType, NormalizedOcrResult } from '@docready/contracts';
import { OCRInput, OCROperation, AzureDocIntelReadAdapter } from './providers/azure';
import { GoogleCloudVisionOcrAdapter } from './providers/gcv';
import { VisionLlmOcrAdapter } from './providers/vision_llm';
import { MockOCRProvider } from './providers/mock';
export { extractFieldCandidates } from './extractor';

export type { OCRInput, OCROperation };

export interface OCRProvider {
  submit(input: OCRInput): Promise<OCROperation>;
  poll(operation: OCROperation): Promise<NormalizedOcrResult>;
}

export { AzureDocIntelReadAdapter, GoogleCloudVisionOcrAdapter, VisionLlmOcrAdapter, MockOCRProvider };

/**
 * Multi-Provider OCR Engine Factory.
 * Resolves active OCR provider based on configuration without hardcoding provider logic.
 */
export function getOCRProvider(providerType?: OcrProviderType | string): OCRProvider {
  const selected = (providerType || process.env.DOCREADY_OCR_PROVIDER || 'mock').toLowerCase();

  switch (selected) {
    case 'azure_read':
      return new AzureDocIntelReadAdapter();
    case 'google_vision':
      return new GoogleCloudVisionOcrAdapter();
    case 'vision_llm':
      return new VisionLlmOcrAdapter();
    case 'mock':
    default:
      return new MockOCRProvider();
  }
}
