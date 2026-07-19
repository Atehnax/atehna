import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  orderHomepageCategories,
} from "../../src/shared/domain/landing/landingPage";

type CategoryPresentation = {
  crop: { x: number; y: number; width: number; height: number };
  focalPoint: { x: number; y: number };
  scale: number;
  offsetX: number;
  offsetY: number;
  fit: "contain" | "cover" | "fill";
  backgroundColor: string;
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
  return presentation.offsetX >= 95
    ? presentation.offsetX - 1
    : presentation.offsetX + 1;
}

async function openCategoryPresentationEditor(page: Page, categorySlug: string) {
  const tile = page.locator(`[data-category-slug="${categorySlug}"]`).first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await tile.hover();
  await tile
    .getByRole("button", { name: "Uredi predstavitev slike", exact: true })
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

  test("category image offsets can be reset to zero independently", async ({
    page,
    request,
  }) => {
    const payload = await readPreviewPayload(request);
    const category = payload.categories[0];
    expect(category).toBeDefined();

    await page.goto("/admin/kategorije/predogled");
    const controls = await openCategoryPresentationEditor(page, category.slug);
    const offsetXInput = controls.locator('input[aria-label^="Odmik X"]');
    const offsetYInput = controls.locator('input[aria-label^="Odmik Y"]');
    const resetXButton = controls.getByRole("button", {
      name: "Nastavi odmik X na 0",
      exact: true,
    });
    const resetYButton = controls.getByRole("button", {
      name: "Nastavi odmik Y na 0",
      exact: true,
    });

    await offsetXInput.fill("18");
    await offsetYInput.fill("-12");
    await expect(resetXButton).toBeEnabled();
    await expect(resetYButton).toBeEnabled();

    await resetXButton.click();
    await expect(offsetXInput).toHaveValue("0");
    await expect(offsetYInput).toHaveValue("-12");
    await expect(resetXButton).toBeDisabled();
    await expect(resetYButton).toBeEnabled();

    await resetYButton.click();
    await expect(offsetXInput).toHaveValue("0");
    await expect(offsetYInput).toHaveValue("0");
    await expect(resetYButton).toBeDisabled();
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

  test("category admin entry routes do not immediately fetch the full unscoped catalog", async ({
    browser,
  }) => {
    const routes = [
      "/admin/kategorije",
      "/admin/kategorije/predogled",
      "/admin/kategorije/miller-view",
    ];

    for (const path of routes) {
      const context = await browser.newContext({ baseURL: "http://localhost:3000" });
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

  test("a presentation-only preview save sends one media patch and no structural patch", async ({
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

    const saveButton = page.getByRole("button", { name: "Shrani", exact: true }).first();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Predstavitev in slike kategorij", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Shrani", exact: true }).click();

    await expect.poll(() => imagePatches.length).toBe(1);
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
      const context = await browser.newContext({ baseURL: "http://localhost:3000" });
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
          new URL(response.url()).pathname === "/api/admin/categories" &&
          new URL(response.url()).searchParams.get("view") === "preview",
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

  test("homepage category order inherits catalog order until custom ordering is explicit", () => {
    const catalogOrder = [
      { slug: "first" },
      { slug: "second" },
      { slug: "third" },
    ];
    const requestedOrder = ["third", "first"];

    expect(DEFAULT_HOMEPAGE_SETTINGS.categories.categoryOrderMode).toBe("catalog");
    expect(
      orderHomepageCategories(catalogOrder, {
        categoryOrderMode: "catalog",
        categoryOrder: requestedOrder,
      }).map((category) => category.slug),
    ).toEqual(["first", "second", "third"]);
    expect(
      orderHomepageCategories(catalogOrder, {
        categoryOrderMode: "custom",
        categoryOrder: requestedOrder,
      }).map((category) => category.slug),
    ).toEqual(["third", "first", "second"]);
  });
});
