import { createElement, type ReactNode } from 'react';
import { pricingFormulaMathTree, pricingFormulaToShort, type PricingFormulaMathNode } from '@/shared/domain/pricingStock';

function mathElement(node: PricingFormulaMathNode, key = 'formula'): ReactNode {
  return createElement(node.tag, { key }, node.text ?? node.children?.map((child, index) => mathElement(child, key + '-' + index)));
}
/** React escapes every text node; no source formula is injected as HTML/MathML. */
export function PricingFormulaMath({ formula, className }: { formula: string; className?: string }) {
  try {
    const expression = pricingFormulaMathTree(formula), short = pricingFormulaToShort(formula);
    return createElement('math', { xmlns: 'http://www.w3.org/1998/Math/MathML', display: 'block', className, 'data-testid': 'pricing-formula-math', 'aria-label': 'Ciljna RVC: ' + short },
      createElement('mrow', null, createElement('mtext', null, 'Ciljna RVC'), createElement('mo', null, '='), mathElement(expression)));
  } catch { return null; }
}
