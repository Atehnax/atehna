import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement, type ContextType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePathname, useSelectedLayoutSegment } from 'next/navigation';
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import type { FlightRouterState } from 'next/dist/shared/lib/app-router-types';
import { loadBoundServerModule } from './support/loadBoundServerModule';

const { default: SiteFooterGate } = loadBoundServerModule<{ default: (props: { footer: object }) => React.ReactNode }>(
  'src/commercial/components/SiteFooterGate.tsx', {
    React, usePathname, useSelectedLayoutSegment,
    SiteFooter: () => createElement('footer', null, 'Canonical footer')
  }
);
function renderGate(pathname: string, children: FlightRouterState) {
  const context: NonNullable<ContextType<typeof LayoutRouterContext>> = {
    parentTree: ['(commercial)', { children }], url: pathname,
    parentCacheNode: { rsc: null, prefetchRsc: null, prefetchHead: null, head: null, slots: null, scrollRef: null, bfcacheId: 1 },
    parentSegmentPath: null, parentParams: {}, parentLoadingData: null,
    debugNameContext: '(commercial)', isActive: true
  };
  return renderToStaticMarkup(createElement(PathnameContext.Provider, { value: pathname },
    createElement(LayoutRouterContext.Provider, { value: context },
      createElement(SiteFooterGate, { footer: {} })
    )
  ));
}

test('the homepage footer gate agrees for public and internal ISR pathnames using the real Next route tree', () => {
  const home: FlightRouterState = ['__PAGE__', {}];
  assert.equal(renderGate('/', home), '');
  assert.equal(renderGate('/index', home), '');
  assert.equal(renderGate('/internal-rewrite', home), '');
});

test('non-home commercial segments keep the shared footer at every nesting level', () => {
  const paths: Array<[string, FlightRouterState]> = [
    ['/products', ['products', { children: ['__PAGE__', {}] }]],
    ['/products/materiali/items/plosca', ['products', { children: ['materiali', { children: ['items', { children: ['plosca', { children: ['__PAGE__', {}] }] }] }] }]],
    ['/contact', ['contact', { children: ['__PAGE__', {}] }]]
  ];
  for (const [pathname, tree] of paths) assert.equal(renderGate(pathname, tree), '<footer>Canonical footer</footer>');
});

test('admin paths retain their existing footer exclusion even with a selected child segment', () => {
  assert.equal(renderGate('/admin/articles', ['articles', { children: ['__PAGE__', {}] }]), '');
});
