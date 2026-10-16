import { describe, it, expect } from 'vitest';
import {
  computePeriodReadiness,
  parseExpectedItemsCsv,
  transitionMissingRequestStatus,
} from '@docready/domain';
import { TenantRepository } from '@docready/db';

describe('Phase S6 Checklist & Missing Document Requests Suite (DR-601 - DR-606)', () => {
  const officeA_id = '11111111-1111-1111-1111-111111111111';
  const clientA1_id = 'a1111111-1111-1111-1111-111111111111';
  const clientA2_id = 'a2222222-2222-2222-2222-222222222222';
  const periodId = 'p1111111-1111-1111-1111-111111111111';
  const scopeA1 = { officeId: officeA_id, clientId: clientA1_id };

  it('[DR-606 / T-22 Invariant] Period without expected list returns coverage_basis = "received_only" and prevents false completeness', () => {
    const readiness = computePeriodReadiness([], [], 5, false);

    expect(readiness.coverageBasis).toBe('received_only');
    expect(readiness.isCompleteAgainstDefinedList).toBe(false);
    expect(readiness.bannerMessage).toContain('Received Only');
    expect(readiness.reviewedDocCount).toBe(5);
  });

  it('[DR-601 & DR-606] Computes complete_against_defined_list when all required expected items are matched', async () => {
    const repo = new TenantRepository([
      {
        id: 'doc_rent_10',
        officeId: officeA_id,
        clientId: clientA1_id,
        periodId,
        documentNumber: 'INV-RENT-10',
        status: 'reviewed',
        revisionNumber: 1,
      },
    ]);

    const expItem = await repo.addExpectedItem(scopeA1, {
      periodId,
      title: 'ค่าเช่าสำนักงานประจำเดือน',
      vendorName: 'บจก. อาคารพาณิชย์',
      expectedAmount: '48150.00',
      source: 'template',
      requirementStatus: 'required',
      createdByUserId: 'user_acc_1',
    });

    // Before matching: should be received_documents_with_exceptions
    const readinessBefore = await repo.getPeriodReadiness(scopeA1, periodId);
    expect(readinessBefore.coverageBasis).toBe('received_documents_with_exceptions');
    expect(readinessBefore.missingRequiredIds).toEqual([expItem.id]);

    // Match document to expected item
    await repo.matchDocumentToExpectedItem(scopeA1, expItem.id, 'doc_rent_10', 'user_acc_1');

    // After matching: should be complete_against_defined_list
    const readinessAfter = await repo.getPeriodReadiness(scopeA1, periodId);
    expect(readinessAfter.coverageBasis).toBe('complete_against_defined_list');
    expect(readinessAfter.isCompleteAgainstDefinedList).toBe(true);
    expect(readinessAfter.missingRequiredIds).toHaveLength(0);
  });

  it('[DR-602] Parses Expected-Register CSV safely without forcing every item to be required', () => {
    const csvInput = [
      'title,vendor_name,expected_amount,requirement_status',
      'ค่าเช่าอาคาร,บจก. อาคารสยาม,45000.00,required',
      '=CMD|ค่าไฟฟ้ารายเดือน,การไฟฟ้านครหลวง,3200.50,conditional',
    ].join('\n');

    const parsed = parseExpectedItemsCsv(csvInput);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.requirementStatus).toBe('required');
    expect(parsed[0]?.expectedAmount).toBe('45000.00');

    // Strips dangerous formula prefix and preserves conditional status
    expect(parsed[1]?.title.startsWith('=')).toBe(false);
    expect(parsed[1]?.requirementStatus).toBe('conditional');
  });

  it('[DR-603 Invariant] Blocks cross-client matching between document and expected item', async () => {
    const repo = new TenantRepository([
      {
        id: 'doc_client_a2',
        officeId: officeA_id,
        clientId: clientA2_id,
        periodId,
        documentNumber: 'INV-A2-99',
        status: 'reviewed',
        revisionNumber: 1,
      },
    ]);

    const expA1 = await repo.addExpectedItem(scopeA1, {
      periodId,
      title: 'ค่าบริการบัญชี',
      source: 'manual',
      requirementStatus: 'required',
      createdByUserId: 'user_acc_1',
    });

    // Attempting to match Client A2's document to Client A1's expected item must fail
    await expect(
      repo.matchDocumentToExpectedItem(scopeA1, expA1.id, 'doc_client_a2')
    ).rejects.toThrow('Target document not found in this tenant scope');
  });

  it('[DR-604 & DR-605 / T-23 Invariant] Hides draft requests from clients and requires staff confirmation to resolve', async () => {
    const repo = new TenantRepository();

    const expItem = await repo.addExpectedItem(scopeA1, {
      periodId,
      title: 'ค่าโฆษณาออนไลน์',
      source: 'template',
      requirementStatus: 'required',
      createdByUserId: 'user_acc_1',
    });

    const req = await repo.createMissingRequest(scopeA1, {
      periodId,
      expectedItemId: expItem.id,
      title: 'ขอใบเสร็จค่าโฆษณา',
      publicMessage: 'รบกวนส่งใบเสร็จค่าโฆษณาประจำเดือนครับ',
      internalNote: 'โน้ตภายในห้ามลูกค้าเห็น',
    });

    // 1. Draft request is hidden from client_user
    const clientViewBeforePublish = await repo.getMissingRequests(scopeA1, periodId, 'client_user');
    expect(clientViewBeforePublish).toHaveLength(0);

    // 2. Staff publishes request -> visible to client without internalNote
    await repo.publishMissingRequest(scopeA1, req.id);
    const clientViewAfterPublish = await repo.getMissingRequests(scopeA1, periodId, 'client_user');
    expect(clientViewAfterPublish).toHaveLength(1);
    expect(clientViewAfterPublish[0]?.internalNote).toBeUndefined();

    // 3. T-23: Client responds -> status becomes 'responded', NEVER 'resolved'
    const { request: afterClientResp } = await repo.submitClientResponse(scopeA1, req.id, {
      responderUserId: 'client_uploader_1',
      responseType: 'no_transaction_explanation',
      explanationText: 'เดือนนี้ไม่ได้ยิงแอดโฆษณาครับ',
    });
    expect(afterClientResp.status).toBe('responded');
    expect(afterClientResp.status).not.toBe('resolved');

    // Client attempting to call staff_resolve directly is rejected
    expect(() =>
      transitionMissingRequestStatus('responded', 'staff_resolve', 'client_user')
    ).toThrow('Client users cannot mark a missing document request as resolved');

    // 4. Staff verifies explanation and resolves request + marks expected item not_applicable
    const resolvedReq = await repo.resolveMissingRequestByStaff(
      scopeA1,
      req.id,
      'staff_reviewer_1',
      'รับทราบ เดือนนี้ไม่มีค่าโฆษณา ปรับรายการเป็น not_applicable',
      true
    );
    expect(resolvedReq.status).toBe('resolved');

    const updatedItems = await repo.getExpectedItems(scopeA1, periodId);
    expect(updatedItems[0]?.requirementStatus).toBe('not_applicable');
  });
});
