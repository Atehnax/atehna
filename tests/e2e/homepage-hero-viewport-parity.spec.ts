import { expect, test, type Locator, type Page } from '@playwright/test';

type BoxMetrics = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type HeroViewportMetrics = {
  viewportWidth: number;
  hero: BoxMetrics;
  media: BoxMetrics;
  content: BoxMetrics;
  contentBlock: BoxMetrics;
  title: BoxMetrics;
  description: BoxMetrics;
  actions: BoxMetrics;
  previousArrow: BoxMetrics | null;
  firstDot: BoxMetrics | null;
  mediaTagName: string;
  mediaFit: string;
  mediaPosition: string;
  primaryActionBackground: string;
  primaryActionColor: string;
  primaryActionFontFamily: string;
};

async function waitForFonts(page: Page) {
  await page.evaluate(async () => document.fonts.ready);
}

const publicStorefront = (page: Page) => page.locator(
  '[data-storefront-theme="true"].commercial-storefront-scale'
);

async function setPublicStorefrontWidth(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  // Keep the public breakpoint tied to the requested browser width. Removing the
  // test runner's scrollbar avoids a 15 px compensation that can cross 1024 px.
  await page.addStyleTag({
    content: 'html, body { overflow-y: hidden !important; scrollbar-gutter: auto !important; }'
  });
  await expect.poll(() => publicStorefront(page).evaluate(
    (element) => Math.round(element.getBoundingClientRect().width)
  )).toBe(width);
}

async function matchDesktopScrollbarBehavior(page: Page) {
  await page.addStyleTag({
    content: 'html { overflow-y: scroll !important; scrollbar-gutter: auto !important; } body { scrollbar-gutter: auto !important; }'
  });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function readClientWidth(page: Page) {
  return page.evaluate(() => document.documentElement.clientWidth);
}

async function readHeroViewportMetrics({
  hero,
  viewport,
  previewScale = 1
}: {
  hero: Locator;
  viewport?: Locator;
  previewScale?: number;
}): Promise<HeroViewportMetrics> {
  return hero.evaluate((heroElement, options) => {
    const root = heroElement as HTMLElement;
    const rootRect = root.getBoundingClientRect();
    const viewportElement = options.viewportSelector
      ? document.querySelector<HTMLElement>(options.viewportSelector)
      : null;
    const publicStorefront = root.closest<HTMLElement>('[data-storefront-theme="true"]');
    const viewportRect = viewportElement?.getBoundingClientRect()
      ?? publicStorefront?.getBoundingClientRect()
      ?? {
        left: 0,
        top: 0,
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight
      };
    const scale = options.previewScale;
    const requiredElement = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing Hero parity target: ${selector}`);
      return element;
    };
    const relativeBox = (element: HTMLElement): BoxMetrics => {
      const rect = element.getBoundingClientRect();
      return {
        left: (rect.left - viewportRect.left) / scale,
        top: (rect.top - rootRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale
      };
    };

    const media = requiredElement('[data-homepage-hero-carousel-media]');
    const mediaStyle = getComputedStyle(media);
    const primaryAction = requiredElement('[data-homepage-hero-actions] a');
    const primaryActionStyle = getComputedStyle(primaryAction);
    const optionalBox = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector);
      return element ? relativeBox(element) : null;
    };
    const videoMedia = media instanceof HTMLVideoElement;

    return {
      viewportWidth: viewportRect.width / scale,
      hero: relativeBox(root),
      media: relativeBox(media),
      content: relativeBox(requiredElement('[data-homepage-hero-content]')),
      contentBlock: relativeBox(requiredElement('[data-homepage-hero-content-block]')),
      title: relativeBox(requiredElement('[data-canvas-element-id="hero:title"] h1')),
      description: relativeBox(requiredElement('[data-canvas-element-id="hero:description"] p')),
      actions: relativeBox(requiredElement('[data-homepage-hero-actions]')),
      previousArrow: optionalBox('[data-homepage-hero-carousel-arrow="previous"]'),
      firstDot: optionalBox('[data-homepage-hero-carousel-dot="0"]'),
      mediaTagName: media.tagName.toLowerCase(),
      mediaFit: videoMedia ? mediaStyle.objectFit : mediaStyle.backgroundSize,
      mediaPosition: videoMedia ? mediaStyle.objectPosition : mediaStyle.backgroundPosition,
      primaryActionBackground: primaryActionStyle.backgroundColor,
      primaryActionColor: primaryActionStyle.color,
      primaryActionFontFamily: primaryActionStyle.fontFamily
    };
  }, {
    viewportSelector: viewport ? '[data-testid="homepage-preview-viewport"]' : null,
    previewScale
  });
}

function expectOptionalBoxToMatch(
  publicBox: BoxMetrics | null,
  previewBox: BoxMetrics | null,
  label: string
) {
  expect(previewBox === null, `${label} visibility must match the public storefront`).toBe(publicBox === null);
  if (publicBox && previewBox) expectBoxToMatch(publicBox, previewBox, label);
}

function expectBoxToMatch(publicBox: BoxMetrics, previewBox: BoxMetrics, label: string) {
  for (const field of ['left', 'top', 'width', 'height'] as const) {
    expect.soft(
      previewBox[field],
      `${label} ${field} must match the public storefront after preview scaling`
    ).toBeCloseTo(publicBox[field], 0);
  }
}

test('Hero preview preserves public full-bleed and content-lane proportions across viewports', async ({ page }) => {
  const scenarios = [
    {
      label: 'Desktop',
      device: 'desktop',
      publicHost: { width: 1327, height: 935 },
      adminHost: { width: 1327, height: 935 },
      fixedPreviewWidth: null,
      wideLane: 'true'
    },
    {
      label: 'Tablica',
      device: 'tablet',
      publicHost: { width: 1024, height: 1000 },
      adminHost: { width: 1440, height: 1000 },
      fixedPreviewWidth: 1024,
      wideLane: 'true'
    },
    {
      label: 'Mobilno',
      device: 'mobile',
      publicHost: { width: 390, height: 1000 },
      adminHost: { width: 1440, height: 1000 },
      fixedPreviewWidth: 390,
      wideLane: 'false'
    }
  ] as const;

  const protectedWrites: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method())
      && (
        url.pathname === '/api/admin/landing-page'
        || url.pathname === '/api/admin/landing-page/media'
        || url.pathname === '/api/admin/landing-page/defaults'
      )
    ) {
      protectedWrites.push(`${request.method()} ${url.pathname}`);
    }
  });

  for (const scenario of scenarios) {
    await page.setViewportSize(scenario.publicHost);
    await page.goto('/');
    if (scenario.device === 'desktop') {
      await matchDesktopScrollbarBehavior(page);
    } else {
      await setPublicStorefrontWidth(page, scenario.publicHost.width, scenario.publicHost.height);
    }

    const publicClientWidth = await readClientWidth(page);
    const publicStorefrontWidth = await publicStorefront(page).evaluate(
      (element) => Math.round(element.getBoundingClientRect().width)
    );
    if (scenario.device === 'desktop') {
      expect(publicStorefrontWidth, 'Desktop public storefront follows the current layout viewport').toBe(publicClientWidth);
    } else {
      expect(publicStorefrontWidth).toBe(scenario.fixedPreviewWidth);
    }

    const publicHero = page.locator('[data-homepage-section="hero"] [data-homepage-hero-root]');
    await expect(publicHero).toBeVisible({ timeout: 15_000 });
    await waitForFonts(page);
    const publicMetrics = await readHeroViewportMetrics({ hero: publicHero });

    expect(publicMetrics.viewportWidth, `${scenario.label} public viewport width`).toBeCloseTo(
      publicStorefrontWidth,
      0
    );
    expect(publicMetrics.hero.left, `${scenario.label} public Hero is full bleed`).toBeCloseTo(0, 0);
    expect(publicMetrics.hero.width).toBeCloseTo(publicMetrics.viewportWidth, 0);
    expect(publicMetrics.media.left).toBeCloseTo(0, 0);
    expect(publicMetrics.media.width).toBeCloseTo(publicMetrics.viewportWidth, 0);
    expect(publicMetrics.mediaFit).toBe('cover');
    expect(publicMetrics.mediaPosition).toBe('50% 50%');

    await page.setViewportSize(scenario.adminHost);
    await page.goto('/admin/podoba/glavna-stran');
    if (scenario.device === 'desktop') await matchDesktopScrollbarBehavior(page);

    const adminClientWidth = await readClientWidth(page);
    const expectedPreviewWidth = scenario.fixedPreviewWidth ?? publicStorefrontWidth;
    if (scenario.device === 'desktop') {
      expect(adminClientWidth, 'Desktop public and admin hosts use the same layout viewport').toBe(publicClientWidth);
      expect(publicMetrics.viewportWidth, 'Desktop public geometry uses the current layout viewport').toBeCloseTo(
        adminClientWidth,
        0
      );
    }

    const previewStage = page.getByTestId('homepage-preview-stage');
    const previewViewport = page.getByTestId('homepage-preview-viewport');
    const previewHeroScale = previewViewport.getByTestId('homepage-preview-hero-storefront-scale');
    const previewHero = previewViewport.locator(
      '[data-homepage-section="hero"] [data-homepage-hero-root]'
    );
    await expect(previewStage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await page.getByRole('group', { name: 'Odzivni predogled' })
      .getByRole('button', { name: scenario.label, exact: true })
      .click();
    await expect(previewStage).toHaveAttribute('data-preview-render-device', scenario.device);
    await expect(previewStage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 15_000 });
    await expect(previewHeroScale).toHaveAttribute('data-preview-wide-lane', scenario.wideLane);
    await expect(previewHero).toBeVisible();
    await expect.poll(() => previewHero.evaluate((element) =>
      element.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length
    )).toBe(0);
    await waitForFonts(page);

    const previewScale = Number(await previewStage.getAttribute('data-preview-scale'));
    expect(previewScale).toBeGreaterThan(0);
    expect(previewScale).toBeLessThanOrEqual(1);
    const previewMetrics = await readHeroViewportMetrics({
      hero: previewHero,
      viewport: previewViewport,
      previewScale
    });

    const previewLogicalWidth = Number(await previewStage.getAttribute('data-preview-logical-width'));
    expect(previewLogicalWidth, `${scenario.label} logical preview width`).toBeCloseTo(expectedPreviewWidth, 0);
    expect(previewMetrics.viewportWidth, `${scenario.label} preview width`).toBeCloseTo(expectedPreviewWidth, 0);
    if (scenario.device === 'desktop') {
      expect(previewLogicalWidth, 'Desktop preview follows the current admin layout viewport').toBeCloseTo(
        adminClientWidth,
        0
      );
      expect(previewMetrics.viewportWidth, 'Desktop preview and public storefront use the same viewport width').toBeCloseTo(
        publicMetrics.viewportWidth,
        0
      );
    }
    expect(previewMetrics.hero.left).toBeCloseTo(0, 0);
    expect(previewMetrics.hero.width).toBeCloseTo(previewMetrics.viewportWidth, 0);
    expect(previewMetrics.media.left).toBeCloseTo(0, 0);
    expect(previewMetrics.media.width).toBeCloseTo(previewMetrics.viewportWidth, 0);
    expect(previewMetrics.mediaTagName).toBe(publicMetrics.mediaTagName);
    expect(previewMetrics.mediaFit).toBe('cover');
    expect(previewMetrics.mediaPosition).toBe('50% 50%');
    expect(previewMetrics.mediaFit).toBe(publicMetrics.mediaFit);
    expect(previewMetrics.mediaPosition).toBe(publicMetrics.mediaPosition);
    expect(previewMetrics.primaryActionBackground).toBe(publicMetrics.primaryActionBackground);
    expect(previewMetrics.primaryActionColor).toBe(publicMetrics.primaryActionColor);
    expect(previewMetrics.primaryActionFontFamily).toBe(publicMetrics.primaryActionFontFamily);

    expectBoxToMatch(publicMetrics.hero, previewMetrics.hero, `${scenario.label} Hero`);
    expectBoxToMatch(publicMetrics.media, previewMetrics.media, `${scenario.label} Hero media`);
    expectBoxToMatch(publicMetrics.content, previewMetrics.content, `${scenario.label} Hero content lane`);
    expectBoxToMatch(publicMetrics.contentBlock, previewMetrics.contentBlock, `${scenario.label} Hero text block`);
    expectBoxToMatch(publicMetrics.title, previewMetrics.title, `${scenario.label} Hero title`);
    expectBoxToMatch(publicMetrics.description, previewMetrics.description, `${scenario.label} Hero description`);
    expectBoxToMatch(publicMetrics.actions, previewMetrics.actions, `${scenario.label} Hero actions`);
    expectOptionalBoxToMatch(
      publicMetrics.previousArrow,
      previewMetrics.previousArrow,
      `${scenario.label} Hero previous arrow`
    );
    expectOptionalBoxToMatch(publicMetrics.firstDot, previewMetrics.firstDot, `${scenario.label} Hero first dot`);
  }

  expect(protectedWrites).toEqual([]);
});
