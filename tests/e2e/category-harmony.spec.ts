import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { ADMIN_STORAGE_STATE_PATH, E2E_BASE_URL } from "./support/auth";

type CategoryPresentation = {
  crop: { x: number; y: number; width: number; height: number };
  focalPoint: { x: number; y: number };
  scale: number;
  offsetOriginX: number;
  offsetOriginY: number;
  offsetX: number;
  offsetY: number;
  fit: "contain" | "cover" | "fill";
  backgroundColor: string;
  ordinalFontSizePx: number;
  ordinalColor: string;
};

type PreviewCategory = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  presentation: CategoryPresentation;
};

type PreviewPayload = {
  categories: PreviewCategory[];
  statuses: Record<string, "active" | "inactive">;
};

type PresentationPatchResponse = {
  ok: boolean;
  updates: Array<PreviewCategory>;
};

async function readPreviewPayload(request: APIRequestContext) {
  const response = await request.get("/api/admin/categories?view=preview");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as PreviewPayload;
}

async function patchPresentation(
  request: APIRequestContext,
  category: Pick<PreviewCategory, "id" | "slug">,
  update: { image?: string | null; presentation?: CategoryPresentation },
) {
  const response = await request.patch("/api/admin/categories/images", {
    data: {
      updates: [
        {
          categoryId: category.id,
          categorySlug: category.slug,
          ...update,
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as PresentationPatchResponse;
}

function changedOffset(presentation: CategoryPresentation) {
  const displayedOffset = Math.round(presentation.offsetX);
  const effectiveOffset = (presentation.offsetOriginX ?? 0) + displayedOffset;
  return effectiveOffset >= 95
    ? displayedOffset - 1
    : displayedOffset + 1;
}

async function openCategoryPresentationEditor(page: Page, categorySlug: string) {
  const tile = page.locator(`[data-category-slug="${categorySlug}"]`).first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await tile.hover();
  await tile
    .getByRole("button", { name: "Uredi videz kategorije", exact: true })
    .click();
  const controls = page.locator("[data-category-media-controls]");
  await expect(controls).toBeVisible();
  return controls;
}

test.describe("category data harmony", () => {
  test("category preview keeps complete category names visible while viewing and editing", async ({
    page,
    request,
  }) => {
    const payload = await readPreviewPayload(request);
    const category = payload.categories.reduce((longest, current) =>
      current.title.length > longest.title.length ? current : longest,
    );

    await page.goto("/admin/kategorije/predogled");
    const tile = page.locator(`[data-category-slug="${category.slug}"]`);
    const heading = tile.locator('[data-testid="category-showcase-title"] h3');
    await expect(heading).toBeVisible({ timeout: 15_000 });
    await expect(heading).toHaveText(category.title);

    const viewMetrics = await heading.evaluate((element) => {
      const style = getComputedStyle(element);
      const titleRect = element.getBoundingClientRect();
      const tileRect = element
        .closest('[data-testid="category-showcase-tile"]')
        ?.getBoundingClientRect();
      return {
        lineClamp: style.webkitLineClamp,
        overflow: style.overflow,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        contained: tileRect
          ? titleRect.top >= tileRect.top - 1 &&
            titleRect.bottom <= tileRect.bottom + 1
          : false,
      };
    });
    expect(viewMetrics.lineClamp).not.toBe("2");
    expect(viewMetrics.overflow).not.toBe("hidden");
    expect(viewMetrics.scrollHeight).toBeLessThanOrEqual(
      viewMetrics.clientHeight + 1,
    );
    expect(viewMetrics.contained).toBe(true);

    await tile.hover();
    await tile.getByRole("button", { name: "Uredi", exact: true }).click();
    const editableTitle = tile.getByLabel("Naziv kategorije", { exact: true });
    await expect(editableTitle).toBeVisible();
    await expect(editableTitle).toHaveText(category.title);
    const editMetrics = await editableTitle.evaluate((element) => ({
      overflow: getComputedStyle(element).overflow,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(editMetrics.overflow).not.toBe("hidden");
    expect(editMetrics.scrollHeight).toBeLessThanOrEqual(
      editMetrics.clientHeight + 1,
    );
  });

  test("category image axes recalibrate to zero without moving the artwork", async ({
    page,
    request,
  }) => {
    const payload = await readPreviewPayload(request);
    const category = payload.categories[0];
    expect(category).toBeDefined();
    let submittedPresentation: CategoryPresentation | null = null;
    await page.route("**/api/admin/categories/images", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as {
        updates: Array<{ categorySlug: string; presentation: CategoryPresentation }>;
      };
      submittedPresentation = body.updates.find(
        (update) => update.categorySlug === category.slug,
      )?.presentation ?? null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, updates: body.updates }),
      });
    });

    await page.goto("/admin/kategorije/predogled");
    const controls = await openCategoryPresentationEditor(page, category.slug);
    const tile = page.locator(`[data-category-slug="${category.slug}"]`).first();
    const presentationLayer = tile.locator("[data-category-showcase-presentation]");
    const offsetXInput = controls.locator('[data-category-media-field="offset-x"]');
    const offsetYInput = controls.locator('[data-category-media-field="offset-y"]');
    const resetXButton = controls.getByRole("button", {
      name: "Nastavi trenutno lego X kot 0",
      exact: true,
    });
    const resetYButton = controls.getByRole("button", {
      name: "Nastavi trenutno lego Y kot 0",
      exact: true,
    });
    const readArtworkGeometry = () => presentationLayer.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        transform: (element as HTMLElement).style.transform,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });

    await offsetXInput.fill("18");
    await offsetYInput.fill("-12");
    await offsetYInput.click();
    await page.waitForTimeout(350);
    await expect(resetXButton).toBeEnabled();
    await expect(resetYButton).toBeEnabled();
    const beforeXCalibration = await readArtworkGeometry();

    await resetXButton.click();
    await expect(offsetXInput).toHaveValue("0");
    await expect(offsetYInput).toHaveValue("-12");
    await expect(resetXButton).toBeDisabled();
    await expect(resetYButton).toBeEnabled();
    expect(await readArtworkGeometry()).toEqual(beforeXCalibration);

    const beforeYCalibration = await readArtworkGeometry();

    await resetYButton.click();
    await expect(offsetXInput).toHaveValue("0");
    await expect(offsetYInput).toHaveValue("0");
    await expect(resetYButton).toBeDisabled();
    expect(await readArtworkGeometry()).toEqual(beforeYCalibration);

    await page.getByRole("button", { name: "Shrani", exact: true }).first().click();
    const saveDialog = page.getByRole("dialog");
    await expect(
      saveDialog.getByText("Videz kategorij", { exact: true }),
    ).toBeVisible();
    await saveDialog.getByRole("button", { name: "Shrani", exact: true }).click();
    await expect.poll(() => submittedPresentation).not.toBeNull();
    expect(submittedPresentation!.offsetX).toBe(0);
    expect(submittedPresentation!.offsetY).toBe(0);
    expect(submittedPresentation!.offsetOriginX).toBeCloseTo(
      (category.presentation.offsetOriginX ?? 0) + 18,
      4,
    );
    expect(submittedPresentation!.offsetOriginY).toBeCloseTo(
      (category.presentation.offsetOriginY ?? 0) - 12,
      4,
    );
  });

  test("category image transfer hints follow the selected column density", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/admin/kategorije/predogled");
    const columns = page.getByLabel("Elementov na vrstico", { exact: true });
    const firstImage = page.getByTestId("category-showcase-tile").first().locator("img");
    await expect(firstImage).toBeVisible({ timeout: 15_000 });

    await columns.fill("8");
    await expect(firstImage).toHaveAttribute(
      "sizes",
      "(min-width: 1025px) 8vw, (min-width: 560px) 21vw, 61vw",
    );

    await columns.fill("3");
    await expect(firstImage).toHaveAttribute(
      "sizes",
      "(min-width: 1025px) 21vw, (min-width: 560px) 21vw, 61vw",
    );
  });

  test("category image editor is compact, clear, and flips beside edge tiles", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/admin/kategorije/predogled");
    const tiles = page.getByTestId("category-showcase-tile");
    await expect(tiles.first()).toBeVisible({ timeout: 15_000 });
    expect(await tiles.count()).toBeGreaterThanOrEqual(4);

    const editorRectBefore = await page
      .locator('[data-category-showcase-editor="category-preview"]')
      .boundingBox();
    const firstControls = await openCategoryPresentationEditor(
      page,
      (await tiles.first().getAttribute("data-category-slug"))!,
    );
    const firstPanel = page.locator("[data-category-media-controls-placement]");
    await expect(firstPanel).toHaveAttribute(
      "data-category-media-controls-placement",
      "right",
    );

    const primaryControlTops = await firstControls
      .locator("[data-category-media-primary-controls] > div")
      .evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().top)),
      );
    expect(primaryControlTops).toHaveLength(3);
    expect(new Set(primaryControlTops).size).toBe(1);
    await expect(firstControls.getByRole("button", { name: "Cela slika" })).toBeVisible();
    await expect(firstControls.getByRole("button", { name: "Zapolni" })).toBeVisible();
    await expect(firstControls.getByRole("button", { name: "Raztegni" })).toBeVisible();
    await expect(firstControls.getByText("Fokus slike", { exact: true })).toBeVisible();
    await expect(firstControls.getByText("Območje obreza", { exact: true })).toBeVisible();

    const firstPlacement = await Promise.all([
      tiles.first().boundingBox(),
      firstPanel.boundingBox(),
    ]);
    expect(firstPlacement[0]).not.toBeNull();
    expect(firstPlacement[1]).not.toBeNull();
    expect(firstPlacement[1]!.x).toBeGreaterThanOrEqual(
      firstPlacement[0]!.x + firstPlacement[0]!.width,
    );
    expect(firstPlacement[1]!.height).toBeLessThan(430);
    expect(await page.locator('[data-category-showcase-editor="category-preview"]').boundingBox())
      .toEqual(editorRectBefore);

    await firstControls.getByRole("button", { name: /Zapri nastavitve/ }).click();
    const fourthTile = tiles.nth(3);
    await fourthTile.hover();
    await fourthTile
      .getByRole("button", { name: "Uredi videz kategorije", exact: true })
      .click();
    const fourthPanel = page.locator("[data-category-media-controls-placement]");
    await expect(fourthPanel).toHaveAttribute(
      "data-category-media-controls-placement",
      "left",
    );
    const fourthPlacement = await Promise.all([
      fourthTile.boundingBox(),
      fourthPanel.boundingBox(),
    ]);
    expect(fourthPlacement[0]).not.toBeNull();
    expect(fourthPlacement[1]).not.toBeNull();
    expect(fourthPlacement[1]!.x + fourthPlacement[1]!.width).toBeLessThanOrEqual(
      fourthPlacement[0]!.x,
    );
    expect(fourthPlacement[1]!.x).toBeGreaterThanOrEqual(8);
    expect(fourthPlacement[1]!.y).toBeGreaterThanOrEqual(8);
    expect(fourthPlacement[1]!.x + fourthPlacement[1]!.width).toBeLessThanOrEqual(1592);
    expect(fourthPlacement[1]!.y + fourthPlacement[1]!.height).toBeLessThanOrEqual(992);
  });

  test("category preview action stack stays comfortably inset from every tile edge", async ({
    page,
  }) => {
    await page.goto("/admin/kategorije/predogled");
    const tile = page.getByTestId("category-showcase-tile").first();
    await expect(tile).toBeVisible({ timeout: 15_000 });
    await tile.hover();

    const stack = tile.getByTestId("category-showcase-action-stack");
    await expect(stack).toBeVisible();
    const geometry = await stack.evaluate((element) => {
      const tileRect = element
        .closest('[data-testid="category-showcase-tile"]')!
        .getBoundingClientRect();
      const buttons = Array.from(element.querySelectorAll("button"));
      const buttonRects = buttons.map((button) => button.getBoundingClientRect());
      return {
        buttonCount: buttons.length,
        maximumButtonSize: Math.max(
          ...buttonRects.flatMap((rect) => [rect.width, rect.height]),
        ),
        top: buttonRects[0].top - tileRect.top,
        right: tileRect.right - Math.max(...buttonRects.map((rect) => rect.right)),
        bottom: tileRect.bottom - buttonRects.at(-1)!.bottom,
      };
    });

    expect(geometry.buttonCount).toBeGreaterThanOrEqual(5);
    expect(geometry.maximumButtonSize).toBeLessThanOrEqual(20.5);
    expect(geometry.top).toBeGreaterThanOrEqual(10);
    expect(geometry.right).toBeGreaterThanOrEqual(10);
    expect(geometry.bottom).toBeGreaterThanOrEqual(10);
  });

  test("Miller date columns show the full changed header", async ({ page }) => {
    await page.setViewportSize({ width: 1329, height: 920 });
    await page.goto("/admin/kategorije/miller-view");

    const changedHeader = page.locator('span[title="Spremenjeno"]').first();
    await expect(changedHeader).toBeVisible({ timeout: 15_000 });
    await expect(changedHeader).toHaveText("Spremenjeno");
    await expect.poll(() => changedHeader.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    )).toBe(true);
  });

  test("category admin entry routes do not immediately fetch the full unscoped catalog", async ({
    browser,
  }) => {
    const routes = [
      "/admin/kategorije",
      "/admin/kategorije/predogled",
      "/admin/kategorije/miller-view",
    ];

    for (const path of routes) {
      const context = await browser.newContext({
        baseURL: E2E_BASE_URL,
        storageState: ADMIN_STORAGE_STATE_PATH,
      });
      const page = await context.newPage();
      const unscopedCatalogRequests: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          request.resourceType() === "fetch" &&
          request.method() === "GET" &&
          url.pathname === "/api/admin/categories" &&
          url.search === ""
        ) {
          unscopedCatalogRequests.push(request.url());
        }
      });

      await page.goto(path);
      if (path.endsWith("/predogled")) {
        await expect(page.getByTestId("category-showcase-tile").first()).toBeVisible({
          timeout: 15_000,
        });
      } else if (path.endsWith("/miller-view")) {
        await expect(page.locator("#miller-search")).toBeVisible({ timeout: 15_000 });
      } else {
        await expect(page.getByRole("tab", { name: "Osnovno" })).toBeVisible({
          timeout: 15_000,
        });
      }
      await page.waitForTimeout(1_000);

      expect(
        unscopedCatalogRequests,
        `${path} should hydrate from its scoped server payload and lazy-load only on an editing action`,
      ).toEqual([]);
      await context.close();
    }
  });

  test("presentation-only preview edits stay local and batch into one media patch", async ({
    page,
  }) => {
    const imagePatches: Array<Record<string, unknown>> = [];
    const structuralPatches: Array<Record<string, unknown>> = [];
    const unscopedCatalogGets: string[] = [];

    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        request.method() === "GET" &&
        url.pathname === "/api/admin/categories" &&
        url.search === ""
      ) {
        unscopedCatalogGets.push(request.url());
      }
    });
    await page.route("**/api/admin/categories/images", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      imagePatches.push(payload);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          updates: (payload.updates as unknown[]) ?? [],
        }),
      });
    });
    await page.route("**/api/admin/categories", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      structuralPatches.push(
        route.request().postDataJSON() as Record<string, unknown>,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/admin/kategorije/predogled");
    const firstTile = page.getByTestId("category-showcase-tile").first();
    await expect(firstTile).toBeVisible({ timeout: 15_000 });
    const categorySlug = await firstTile.getAttribute("data-category-slug");
    expect(categorySlug).toBeTruthy();

    const controls = await openCategoryPresentationEditor(page, categorySlug!);
    const offsetInput = controls.locator('input[aria-label^="Odmik X"]');
    const currentOffset = Number(await offsetInput.inputValue());
    await offsetInput.fill(String(currentOffset >= 95 ? currentOffset - 1 : currentOffset + 1));

    await controls.getByRole("button", { name: /Zapri nastavitve/ }).click();
    const secondTile = page.getByTestId("category-showcase-tile").nth(1);
    const secondCategorySlug = await secondTile.getAttribute("data-category-slug");
    expect(secondCategorySlug).toBeTruthy();
    const secondControls = await openCategoryPresentationEditor(page, secondCategorySlug!);
    const secondOffsetInput = secondControls.locator('input[aria-label^="Odmik X"]');
    const secondCurrentOffset = Number(await secondOffsetInput.inputValue());
    await secondOffsetInput.fill(String(secondCurrentOffset >= 95 ? secondCurrentOffset - 1 : secondCurrentOffset + 1));

    expect(imagePatches).toEqual([]);
    expect(structuralPatches).toEqual([]);
    expect(unscopedCatalogGets).toEqual([]);

    const saveButton = page.getByRole("button", { name: "Shrani", exact: true }).first();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Videz kategorij", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Shrani", exact: true }).click();

    await expect.poll(() => imagePatches.length).toBe(1);
    const submittedUpdates = imagePatches[0].updates as Array<{ categorySlug?: string }>;
    expect(submittedUpdates).toHaveLength(2);
    expect(submittedUpdates.map((update) => update.categorySlug).sort()).toEqual(
      [categorySlug, secondCategorySlug].sort(),
    );
    expect(structuralPatches).toEqual([]);
    expect(unscopedCatalogGets).toEqual([]);
  });

  test("table and Miller structural patches omit top-level showcase images", async ({
    browser,
    request,
  }) => {
    const payload = await readPreviewPayload(request);
    const category = payload.categories[0];
    expect(category).toBeDefined();

    const exerciseRoute = async (path: string, view: "table" | "miller") => {
      const context = await browser.newContext({
        baseURL: E2E_BASE_URL,
        storageState: ADMIN_STORAGE_STATE_PATH,
      });
      const page = await context.newPage();
      const structuralPatches: Array<{
        upserts?: Array<Record<string, unknown>>;
      }> = [];
      await page.route("**/api/admin/categories", async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.continue();
          return;
        }
        structuralPatches.push(route.request().postDataJSON());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      });

      await page.goto(path);
      if (view === "table") {
        await page
          .getByRole("button", { name: `Možnosti za ${category.title}`, exact: true })
          .click();
        await page.getByRole("menuitem", { name: "Uredi", exact: true }).click();
        const titleInput = page
          .locator('input[data-inline-edit-field="true"]')
          .first();
        await expect(titleInput).toBeVisible();
        await titleInput.fill(`${category.title} test`);
        await page
          .getByRole("button", {
            name: `Shrani urejanje za ${category.title}`,
            exact: true,
          })
          .click();
      } else {
        const millerSection = page.locator("section").filter({
          has: page.locator("#miller-search"),
        });
        const row = millerSection
          .locator("button[data-miller-id]")
          .filter({ hasText: category.title })
          .first();
        await expect(row).toBeVisible({ timeout: 15_000 });
        await row.click({ button: "right" });
        const renameInput = page.getByRole("textbox", {
          name: "Preimenuj",
          exact: true,
        });
        await expect(renameInput).toBeVisible();
        await renameInput.fill(`${category.title} test`);
        await renameInput.press("Enter");
        const saveButton = millerSection.getByRole("button", {
          name: "Shrani",
          exact: true,
        });
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Shrani", exact: true })
          .click();
      }

      await expect.poll(() => structuralPatches.length).toBe(1);
      const categoryUpsert = structuralPatches[0]?.upserts?.find(
        (upsert) => upsert.id === category.id,
      );
      expect(categoryUpsert).toBeDefined();
      expect(categoryUpsert).not.toHaveProperty("image");
      await context.close();
    };

    await exerciseRoute("/admin/kategorije", "table");
    await exerciseRoute("/admin/kategorije/miller-view", "miller");
  });

  test("a stale structural save cannot overwrite newer shared image or presentation data", async ({
    request,
  }) => {
    const payload = await readPreviewPayload(request);
    const category = payload.categories[0];
    expect(category).toBeDefined();

    const canonicalBefore = await patchPresentation(request, category, {
      presentation: category.presentation,
    });
    const originalImage = canonicalBefore.updates[0]?.image ?? "";
    const originalPresentation = category.presentation;
    const nextPresentation = {
      ...originalPresentation,
      offsetX: changedOffset(originalPresentation),
    };
    const separator = originalImage.includes("?") ? "&" : "?";
    const nextImage = `${
      originalImage || "/images/categories/cutouts/tehnika-in-tehnologija.png"
    }${separator}category-harmony=${Date.now()}`;
    let changed = false;

    try {
      await patchPresentation(request, category, {
        image: nextImage,
        presentation: nextPresentation,
      });
      changed = true;

      const structuralResponse = await request.patch("/api/admin/categories", {
        data: {
          upserts: [
            {
              id: category.id,
              parentId: null,
              slug: category.slug,
              title: category.title,
              summary: category.summary,
              description: category.description,
              image: originalImage,
              removeImage: false,
              items: [],
              position: 0,
              status: payload.statuses[`cat:${category.slug}`] ?? "active",
            },
          ],
          deleteIds: [],
        },
      });
      expect(structuralResponse.ok()).toBeTruthy();

      const canonicalAfter = await patchPresentation(request, category, {
        presentation: nextPresentation,
      });
      expect(canonicalAfter.updates[0]?.image).toBe(nextImage);
      expect(canonicalAfter.updates[0]?.presentation).toEqual(nextPresentation);
    } finally {
      if (changed) {
        const restore = await request.patch("/api/admin/categories/images", {
          data: {
            updates: [
              {
                categoryId: category.id,
                categorySlug: category.slug,
                image: originalImage || null,
                presentation: originalPresentation,
              },
            ],
          },
        });
        expect.soft(restore.ok()).toBeTruthy();
      }
    }
  });

  test("a saved presentation refreshes an already-open category admin tab", async ({
    context,
    page,
    request,
  }) => {
    const payload = await readPreviewPayload(request);
    const category = payload.categories[0];
    expect(category).toBeDefined();
    const nextOffset = changedOffset(category.presentation);
    const secondPage = await context.newPage();
    let changed = false;

    try {
      await Promise.all([
        page.goto("/admin/kategorije/predogled"),
        secondPage.goto("/admin/kategorije/predogled"),
      ]);
      await expect(page.locator(`[data-category-slug="${category.slug}"]`).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        secondPage.locator(`[data-category-slug="${category.slug}"]`).first(),
      ).toBeVisible({ timeout: 15_000 });

      const firstControls = await openCategoryPresentationEditor(page, category.slug);
      await firstControls.locator('input[aria-label^="Odmik X"]').fill(String(nextOffset));

      const secondPageRefresh = secondPage.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname === "/api/admin/categories/images" &&
          new URL(response.url()).searchParams.get("slugs")?.split(",").includes(category.slug) === true,
        { timeout: 15_000 },
      );
      const saveResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname === "/api/admin/categories/images",
      );
      await page.getByRole("button", { name: "Shrani", exact: true }).first().click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Shrani", exact: true })
        .click();
      expect((await saveResponse).ok()).toBeTruthy();
      changed = true;

      await secondPage.bringToFront();
      expect((await secondPageRefresh).ok()).toBeTruthy();
      const secondControls = await openCategoryPresentationEditor(
        secondPage,
        category.slug,
      );
      await expect(
        secondControls.locator('input[aria-label^="Odmik X"]'),
      ).toHaveValue(String(nextOffset));
    } finally {
      await secondPage.close();
      if (changed) {
        const restore = await request.patch("/api/admin/categories/images", {
          data: {
            updates: [
              {
                categoryId: category.id,
                categorySlug: category.slug,
                presentation: category.presentation,
              },
            ],
          },
        });
        expect.soft(restore.ok()).toBeTruthy();
      }
    }
  });

});
