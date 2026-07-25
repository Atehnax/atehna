import { expect, test } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Oprema za tehni/i
    })
  ).toBeVisible();
});

test('order page loads', async ({ page }) => {
  await page.goto('/order');

  await expect(page.getByTestId('order-page')).toBeVisible({ timeout: 15000 });
});

async function expectAdminRouteProtectedOrLoaded(page: import('@playwright/test').Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();

  const status = response!.status();

  if (status === 401 || status === 403) {
    return;
  }

  const expectedPath = path.replace(/\/$/, '');
  const loginPath = '/admin';

  await page.waitForURL(
    (url) => {
      const normalizedPath = url.pathname.replace(/\/$/, '');
      return normalizedPath === expectedPath || normalizedPath === loginPath;
    },
    { timeout: 15000 }
  );

  const finalPath = new URL(page.url()).pathname.replace(/\/$/, '');
  expect([expectedPath, loginPath]).toContain(finalPath);
}

test('admin orders route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/orders');
});

test('admin artikli route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/artikli');
});

test('admin podoba entry defaults to landing appearance or is protected', async ({ page }) => {
  await page.goto('/admin/podoba');
  await expect.poll(() => {
    const pathname = new URL(page.url()).pathname.replace(/\/$/, '');
    return pathname === '/admin/podoba/glavna-stran' || pathname === '/admin';
  }, { timeout: 15000 }).toBeTruthy();
});

test('admin landing appearance route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/podoba/glavna-stran');
});

test('admin logo route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/podoba/logotip');
});

test('admin global parameters route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/podoba/globalni-parametri');
});

test('admin podoba tabs put landing before navigation when loaded', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/podoba/glavna-stran');

  const finalPath = new URL(page.url()).pathname.replace(/\/$/, '');
  if (finalPath !== '/admin/podoba/glavna-stran') return;

  await expect(page.locator('nav a[href="/admin/podoba/glavna-stran"]')).toHaveCount(1);
  await expect(page.getByRole('tab').nth(0)).toHaveText('Glavna stran');
  await expect(page.getByRole('tab').nth(1)).toHaveText('Navigacija');
});

test('admin podoba archive route is accessible or protected', async ({ page }) => {
  await expectAdminRouteProtectedOrLoaded(page, '/admin/arhiv/podoba');
});

test('landing page API rejects invalid element type', async ({ request }) => {
  const response = await request.put('/api/admin/landing-page', {
    data: {
      config: {
        elements: [
          {
            id: 'bad',
            type: 'bad_type',
            adminLabel: 'Bad',
            enabled: true,
            position: 0,
            content: {
              title: 'Bad',
              description: '',
              primaryButton: { label: '', url: '' },
              secondaryButton: { label: '', url: '' }
            },
            media: { source: 'none', url: '', title: '', description: '', alt: '', decorative: false },
            mediaItems: [],
            items: [],
            layout: {
              desktop: {
                visible: true,
                alignment: 'left',
                mediaPosition: 'right',
                spacingAfter: 'medium',
                maxWidth: 'wide',
                verticalPadding: 'medium',
                imageFit: 'cover',
                focalPoint: 'center'
              },
              tablet: { inherits: 'desktop', overrides: {} },
              mobile: { inherits: 'tablet', overrides: {} }
            }
          }
        ]
      }
    }
  });

  expect(response.status()).toBe(400);
});
