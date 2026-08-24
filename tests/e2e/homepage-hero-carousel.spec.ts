import { expect, test } from '@playwright/test';

type LandingPageSave = {
  config: {
    hero: {
      autoplay: boolean;
      autoplayInterval: number;
      slides: Array<{
        id: string;
        src: string;
      }>;
    };
  };
};

const uploadedSlideUrl = '/images/technical-preview/sheet.webp';
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7xkAAAAASUVORK5CYII=',
  'base64'
);

test('hero carousel settings add, reorder, preview, and save one shared slide sequence', async ({ page }) => {
  await page.setViewportSize({ width: 1327, height: 874 });

  const uploads: string[] = [];
  const saves: LandingPageSave[] = [];
  const authorizedUploadPathnames = new Set<string>();

  await page.route('**/api/admin/media', async (route) => {
    expect(route.request().method()).toBe('POST');
    const body = route.request().postDataJSON() as {
      type: string;
      payload: {
        pathname: string;
        clientPayload: string;
        multipart: boolean;
      };
    };
    const clientPayload = JSON.parse(body.payload.clientPayload) as {
      contentType: string;
      scope: string;
    };
    expect(body.type).toBe('blob.generate-presigned-url');
    expect(body.payload.multipart).toBe(false);
    expect(clientPayload.scope).toBe('landing-media');
    expect(clientPayload.contentType).toBe('image/png');
    expect(body.payload.pathname).toMatch(/^landing-page\//u);
    authorizedUploadPathnames.add(body.payload.pathname);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        presignedUrl: `/api/e2e/public-media-upload?pathname=${encodeURIComponent(body.payload.pathname)}`
      })
    });
  });
  await page.route('**/api/e2e/public-media-upload?*', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('PUT');
    expect(await request.headerValue('content-type')).toBe('image/png');
    const pathname = new URL(request.url()).searchParams.get('pathname') ?? '';
    expect(authorizedUploadPathnames.has(pathname)).toBe(true);
    expect(request.postDataBuffer()?.byteLength).toBe(onePixelPng.byteLength);
    uploads.push(pathname);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: uploadedSlideUrl,
        pathname
      })
    });
  });

  await page.route('**/api/admin/landing-page', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }

    const body = route.request().postDataJSON() as LandingPageSave;
    saves.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        config: {
          ...body.config,
          updatedAt: '2026-07-22T12:00:00.000Z'
        }
      })
    });
  });

  await page.goto('/admin/podoba/glavna-stran');
  const stage = page.getByTestId('homepage-preview-stage');
  await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });

  const liveLayer = page.getByTestId('homepage-preview-live-layer');
  const hero = liveLayer.locator('[data-homepage-section="hero"] [data-homepage-hero-root]');
  await expect(hero).toBeVisible();
  const heroBox = await hero.boundingBox();
  expect(heroBox).not.toBeNull();
  await hero.click({ position: { x: heroBox!.width - 4, y: 4 } });

  const floatingToolbar = page.locator(
    '[data-testid="homepage-context-toolbar"][data-toolbar-mode="floating"]'
  );
  const carouselButton = floatingToolbar.getByTestId('homepage-hero-carousel-toolbar-button');
  await expect(carouselButton).toBeVisible();
  await expect(carouselButton).toHaveAccessibleName('Slike in vrtiljak');
  await carouselButton.click();

  const settings = page.getByTestId('homepage-hero-carousel-settings');
  await expect(settings).toBeVisible();
  const mode = settings.getByTestId('homepage-hero-carousel-mode');
  await expect(mode.getByTestId('homepage-hero-carousel-mode-manual')).toHaveText('Ročno');
  await expect(mode.getByTestId('homepage-hero-carousel-mode-autoplay')).toHaveText('Samodejno');
  await expect(settings.getByTestId('homepage-hero-carousel-interval')).toHaveCount(0);

  await mode.getByTestId('homepage-hero-carousel-mode-autoplay').click();
  const interval = settings.getByTestId('homepage-hero-carousel-interval');
  await expect(interval).toBeVisible();
  const intervalSeconds = interval.getByRole('spinbutton', { name: 'Čas menjave', exact: true });
  await expect(intervalSeconds).toBeVisible();
  await expect(interval.getByText('s', { exact: true })).toBeVisible();
  await intervalSeconds.fill('30');

  await settings.getByTestId('homepage-hero-carousel-add-input').setInputFiles({
    name: 'drugi-diapozitiv.png',
    mimeType: 'image/png',
    buffer: onePixelPng
  });

  const slideRows = settings.getByTestId('homepage-hero-carousel-slide');
  await expect(slideRows).toHaveCount(2);
  await expect.poll(() => uploads.length).toBe(1);
  const orderBeforeMove = await slideRows.evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-slide-id') ?? '')
  );
  expect(orderBeforeMove).toHaveLength(2);
  expect(orderBeforeMove.every(Boolean)).toBeTruthy();

  await slideRows.nth(1).getByTestId('homepage-hero-carousel-slide-up').click();
  const expectedOrder = [orderBeforeMove[1], orderBeforeMove[0]];
  await expect.poll(() => slideRows.evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-slide-id') ?? '')
  )).toEqual(expectedOrder);

  await expect(hero).toHaveAttribute('data-homepage-hero-slide-count', '2');
  const dots = hero.locator('[data-homepage-hero-carousel-dot]');
  await expect(dots).toHaveCount(2);
  expect(await dots.evaluateAll((buttons) => buttons.every((button) => {
    const bounds = button.getBoundingClientRect();
    const radius = Number.parseFloat(getComputedStyle(button).borderRadius);
    return Math.abs(bounds.width - bounds.height) <= 0.5 && radius >= bounds.width / 2;
  }))).toBeTruthy();
  await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true');
  await expect(dots.nth(1)).not.toHaveAttribute('aria-current', 'true');
  await expect(hero.locator('[data-homepage-hero-carousel-arrow="previous"]')).toBeVisible();
  await expect(hero.locator('[data-homepage-hero-carousel-arrow="next"]')).toBeVisible();

  await dots.nth(1).click();
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
  await hero.locator('[data-homepage-hero-carousel-arrow="previous"]').click();
  await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true');
  await hero.locator('[data-homepage-hero-carousel-arrow="next"]').click();
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');

  const saveButton = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect.poll(() => saves.length).toBe(1);
  await page.waitForTimeout(100);
  expect(uploads).toHaveLength(1);
  expect(saves).toHaveLength(1);
  expect(saves[0].config.hero.autoplay).toBe(true);
  expect(saves[0].config.hero.autoplayInterval).toBe(30_000);
  expect(saves[0].config.hero.slides.map((slide) => slide.id)).toEqual(expectedOrder);
  expect(saves[0].config.hero.slides[0]?.src).toBe(uploadedSlideUrl);
});
