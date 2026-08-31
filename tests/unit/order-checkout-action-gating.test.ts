import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const checkoutPath = resolve(
  process.cwd(),
  'src/commercial/order/components/OrderPageClient.tsx'
);
const checkoutSource = readFileSync(checkoutPath, 'utf8');
const sourceFile = ts.createSourceFile(
  checkoutPath,
  checkoutSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

const getAttribute = (element: ts.JsxElement, name: string) => {
  const attribute = element.openingElement.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name
  );
  const initializer = attribute?.initializer;

  return initializer && ts.isStringLiteral(initializer)
    ? initializer.text
    : null;
};

const findElements = (
  root: ts.Node,
  predicate: (element: ts.JsxElement) => boolean
) => {
  const matches: ts.JsxElement[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && predicate(node)) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  };

  visit(root);
  return matches;
};

const isQuoteFlag = (expression: ts.Expression): boolean => {
  const unwrapped = ts.isParenthesizedExpression(expression)
    ? expression.expression
    : expression;

  return ts.isIdentifier(unwrapped) && unwrapped.text === 'quoteRequestsEnabled';
};

const isGuardedByQuoteFlag = (node: ts.Node, root: ts.Node) => {
  let current: ts.Node = node;

  while (current !== root && current.parent) {
    const parent = current.parent;

    if (
      ts.isConditionalExpression(parent) &&
      isQuoteFlag(parent.condition) &&
      node.pos >= parent.whenTrue.pos &&
      node.end <= parent.whenTrue.end
    ) {
      return true;
    }

    current = parent;
  }

  return false;
};

const assertContextualActionContract = (
  root: ts.JsxElement,
  layout: string
) => {
  const checkoutButtons = findElements(
    root,
    (element) =>
      element.openingElement.tagName.getText(sourceFile) === 'button' &&
      getAttribute(element, 'name') === 'checkoutIntent'
  );

  assert.equal(
    checkoutButtons.length,
    1,
    `${layout} must render exactly one contextual submit action`
  );

  const actionSource = checkoutButtons[0].getText(sourceFile);
  assert.match(actionSource, /value=\{activeCheckoutIntent\}/u);
  assert.match(actionSource, /disabled=\{checkoutActionDisabled\}/u);
  assert.match(actionSource, /\{checkoutActionLabel\}/u);
  assert.doesNotMatch(actionSource, /value="(?:order|quote_request)"/u);
};

test('checkout selects a feature-gated intent at the top and exposes one action per layout', () => {
  const intentSections = findElements(
    sourceFile,
    (element) =>
      element.openingElement.tagName.getText(sourceFile) === 'section' &&
      getAttribute(element, 'data-testid') === 'order-checkout-intent-section'
  );
  const desktopLayouts = findElements(
    sourceFile,
    (element) =>
      element.openingElement.tagName.getText(sourceFile) === 'aside' &&
      getAttribute(element, 'data-testid') === 'order-summary-column'
  );
  const mobileLayouts = findElements(
    sourceFile,
    (element) =>
      element.openingElement.tagName.getText(sourceFile) === 'div' &&
      (getAttribute(element, 'className') ?? '').includes('sticky bottom-0') &&
      (getAttribute(element, 'className') ?? '').includes('lg:hidden')
  );

  assert.equal(intentSections.length, 1, 'checkout must have one intent selector');
  assert.equal(
    isGuardedByQuoteFlag(intentSections[0], sourceFile),
    true,
    'the intent selector must be hidden when quote requests are disabled'
  );
  assert.match(
    checkoutSource,
    /const \[checkoutIntent, setCheckoutIntent\][\s\S]*?useState<CheckoutIntent>\('order'\)/u,
    'direct order must remain the default intent'
  );
  assert.match(
    checkoutSource,
    /quoteRequestsEnabled && checkoutIntent === 'quote_request'[\s\S]*?const isQuoteRequest = activeCheckoutIntent === 'quote_request'/u,
    'quote mode must require both the feature flag and the selected intent'
  );
  assert.match(
    checkoutSource,
    /aria-label="Način oddaje"[\s\S]*?CHECKOUT_INTENT_OPTIONS\.map/u
  );
  assert.match(
    checkoutSource,
    /\{isQuoteRequest \? \([\s\S]*?data-testid="quote-request-details-section"/u,
    'quote details must render only in quote mode'
  );

  assert.equal(desktopLayouts.length, 1, 'checkout must have one desktop action layout');
  assert.equal(mobileLayouts.length, 1, 'checkout must have one mobile action layout');
  assertContextualActionContract(desktopLayouts[0], 'desktop');
  assertContextualActionContract(mobileLayouts[0], 'mobile');
});
