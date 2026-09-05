import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  emailTemplateEditorAttribute,
  normalizeEmailTemplatePresentation,
  resolveEmailTemplateSpacingPx,
  validateEmailTemplatePresentation
} from '@/shared/domain/emailTemplateLayout';

describe('email template layout', () => {
  test('normalizes only allowlisted bounded numeric spacing', () => {
    assert.deepEqual(
      normalizeEmailTemplatePresentation({
        verticalSpacingPx: 18.6,
        blockSpacingPx: {
          sharedHeader: -4,
          systemDetails: 500,
          items: 12,
          sharedFooter: '16',
          injected: 20
        }
      }),
      {
        verticalSpacingPx: 19,
        blockSpacingPx: {
          sharedHeader: 0,
          systemDetails: 64,
          items: 12
        }
      }
    );
    assert.equal(
      normalizeEmailTemplatePresentation({
        verticalSpacingPx: '12;position:fixed'
      }),
      undefined
    );
  });

  test('resolves a block override before the global and legacy values', () => {
    const presentation = normalizeEmailTemplatePresentation({
      verticalSpacingPx: 14,
      blockSpacingPx: { totals: 7 }
    });
    assert.equal(
      resolveEmailTemplateSpacingPx(presentation, 'totals', 18),
      7
    );
    assert.equal(
      resolveEmailTemplateSpacingPx(presentation, 'sharedFooter', 28),
      14
    );
    assert.equal(
      resolveEmailTemplateSpacingPx(undefined, 'sharedFooter', 28),
      28
    );
    assert.equal(
      resolveEmailTemplateSpacingPx(
        { verticalSpacingPx: '12;position:fixed' } as unknown as Parameters<
          typeof resolveEmailTemplateSpacingPx
        >[0],
        'sharedFooter',
        28
      ),
      28
    );
  });

  test('rejects malformed PUT values instead of silently accepting clamps', () => {
    assert.deepEqual(validateEmailTemplatePresentation(undefined), []);
    assert.ok(
      validateEmailTemplatePresentation({
        verticalSpacingPx: 65,
        blockSpacingPx: {
          items: -1,
          unknownBlock: 12
        }
      }).length >= 3
    );
    assert.ok(
      validateEmailTemplatePresentation({
        verticalSpacingPx: Number.NaN
      }).length > 0
    );
  });

  test('emits inert editor metadata only when preview mode is explicit', () => {
    assert.equal(
      emailTemplateEditorAttribute(undefined, 'templateContent'),
      ''
    );
    assert.equal(
      emailTemplateEditorAttribute({}, 'templateContent'),
      ''
    );
    assert.equal(
      emailTemplateEditorAttribute(
        { editorPreview: true },
        'templateContent'
      ),
      ' data-email-editor-id="templateContent"'
    );
  });
});
