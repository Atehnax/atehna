import { expect, test, type Locator, type Page } from "@playwright/test";
import { ADMIN_STORAGE_STATE_PATH } from "./support/auth";

async function requireBox(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label} must be rendered.`);
  return box;
}

async function selectCustomOption(
  page: Page,
  trigger: Locator,
  optionName: string,
) {
  await trigger.click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

async function expectAlignedFieldPair(
  left: Locator,
  right: Locator,
  label: string,
) {
  const [leftBox, rightBox] = await Promise.all([
    requireBox(left, `${label} left field`),
    requireBox(right, `${label} right field`),
  ]);
  expect(Math.abs(leftBox.y - rightBox.y), label).toBeLessThanOrEqual(1);
  expect(Math.abs(leftBox.height - rightBox.height), label).toBeLessThanOrEqual(
    1,
  );
  expect(rightBox.x, label).toBeGreaterThan(leftBox.x + leftBox.width);
}

async function expectSharpAdminFocus(control: Locator) {
  const colors = await control.evaluate((element) => {
    const neutralBorderColor = getComputedStyle(element).borderColor;
    const colorProbe = document.createElement("span");
    colorProbe.style.color = "var(--blue-500)";
    document.body.append(colorProbe);
    const canonicalBorderColor = getComputedStyle(colorProbe).color;
    colorProbe.remove();
    return { canonicalBorderColor, neutralBorderColor };
  });
  await control.focus();
  await expect(control).toBeFocused();

  await expect
    .poll(
      () =>
        control.evaluate((element) => {
          const style = getComputedStyle(element);
          const shadowLayers =
            style.boxShadow === "none"
              ? []
              : style.boxShadow.split(/,(?![^(]*\))/u);
          const hasBlurredShadow = shadowLayers.some((shadow) => {
            const lengths = Array.from(
              shadow.matchAll(/-?\d*\.?\d+px/gu),
              (match) => Number.parseFloat(match[0]),
            );
            return (
              Math.abs(lengths[2] ?? 0) > 0.01 ||
              Math.abs(lengths[3] ?? 0) > 0.01
            );
          });
          const hasVisibleOutline =
            style.outlineStyle !== "none" &&
            Number.parseFloat(style.outlineWidth) > 0 &&
            style.outlineColor !== "transparent" &&
            style.outlineColor !== "rgba(0, 0, 0, 0)";
          return {
            borderColor: style.borderColor,
            hasBlurredShadow,
            hasVisibleOutline,
          };
        }),
      { timeout: 1_000 },
    )
    .toEqual({
      borderColor: colors.canonicalBorderColor,
      hasBlurredShadow: false,
      hasVisibleOutline: false,
    });
  expect(colors.canonicalBorderColor).not.toBe(colors.neutralBorderColor);
}

function contentEditableInside(editorSurface: Locator) {
  return editorSurface.locator('[contenteditable="true"]');
}

async function expectAudienceTabsWithoutVerticalScroll(section: Locator) {
  const tabList = section.getByRole("tablist", {
    name: "Prejemniki predloge sporočila",
  });
  await expect(tabList.getByRole("tab")).toHaveCount(4);

  const horizontalViewport = tabList.locator("..");
  await expect(horizontalViewport).toHaveCSS("overflow-y", "hidden");
  await expect
    .poll(() =>
      horizontalViewport.evaluate(
        (element) => element.scrollHeight <= element.clientHeight + 1,
      ),
    )
    .toBe(true);
}

async function openEmailContextEditor(
  page: Page,
  previewTestId: string,
  blockId: string,
) {
  const target = page.getByTestId(
    `${previewTestId}-editor-block-${blockId}`,
  );
  await expect(target).toBeVisible();
  await target.click();
  const toolbar = page.getByTestId(`${previewTestId}-editor-toolbar`);
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Uredi izbrani element" }).click();
  return toolbar;
}

async function openEmailSubjectEditor(page: Page, previewTestId: string) {
  const toolbar = await openEmailContextEditor(page, previewTestId, "subject");
  return toolbar.getByLabel("Zadeva", { exact: true });
}

async function openEmailContentEditor(
  page: Page,
  previewTestId: string,
  idPrefix: string,
) {
  await openEmailContextEditor(page, previewTestId, "templateContent");
  const surface = page.getByTestId(`${idPrefix}-content-editor`);
  await expect(surface).toBeVisible();
  return { surface, editor: contentEditableInside(surface) };
}

async function replaceRichEmailContent(
  page: Page,
  editor: Locator,
  content: { greeting: string; heading: string; body: string },
) {
  const greeting = editor.locator(":scope > p").first();
  const heading = editor.locator(":scope > h1").first();
  const body = editor.locator(":scope > p").last();
  await expect(greeting).toBeVisible();
  await expect(heading).toBeVisible();
  await expect(body).toBeVisible();

  for (const [node, value] of [
    [greeting, content.greeting],
    [heading, content.heading],
    [body, content.body],
  ] as const) {
    await node.selectText();
    await page.keyboard.insertText(value);
    const previewNeedle = value
      .split(/\{\{[^}]+\}\}/u)
      .sort((left, right) => right.length - left.length)[0]
      ?.trim() ?? value;
    await expect
      .poll(async () => {
        const srcDoc = await page
          .locator('iframe[data-testid$="-preview-frame"]:visible')
          .getAttribute("srcdoc");
        return srcDoc ?? "";
      })
      .toContain(previewNeedle);
  }
}

async function expectRichEmailContent(
  editor: Locator,
  content: { greeting: string; heading: string; body: string },
) {
  await expect(editor.locator(":scope > p").first()).toHaveText(
    content.greeting,
  );
  await expect(editor.locator(":scope > h1").first()).toHaveText(
    content.heading,
  );
  await expect(editor.locator(":scope > p").last()).toHaveText(content.body);
}

test.use({ storageState: ADMIN_STORAGE_STATE_PATH });

async function waitForEmailClient(page: Page) {
  await expect(page.getByTestId("order-email-client-surface")).toHaveAttribute(
    "data-client-ready",
    "true",
  );
}

test("admin email settings use the grouped reference layout responsively", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1294, height: 920 });
  await page.goto("/admin/email");
  await waitForEmailClient(page);

  const settingsPanel = page.getByTestId("order-email-settings-panel");
  await expect(settingsPanel).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Razdelki nastavitev e-pošte" }),
  ).toHaveCSS("border-bottom-width", "1px");
  await expect(settingsPanel.getByRole("heading", { level: 2 })).toHaveText([
    "Pošiljanje",
    "Pošiljatelj in povezave",
    "Potrditve in prejemniki",
    "Preizkus pošiljanja",
  ]);

  const settingsCards = settingsPanel.locator(":scope > div");
  await expect(settingsCards).toHaveCount(4);
  const desktopCardBoxes = await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      requireBox(settingsCards.nth(index), `settings card ${index + 1}`),
    ),
  );
  for (let index = 1; index < desktopCardBoxes.length; index += 1) {
    expect(
      Math.abs(desktopCardBoxes[index].x - desktopCardBoxes[0].x),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(desktopCardBoxes[index].width - desktopCardBoxes[0].width),
    ).toBeLessThanOrEqual(1);
    expect(desktopCardBoxes[index].y).toBeGreaterThanOrEqual(
      desktopCardBoxes[index - 1].y + desktopCardBoxes[index - 1].height,
    );
  }
  const cardColors = await settingsCards.evaluateAll((cards) =>
    cards.map((card) => ({
      backgroundColor: getComputedStyle(card).backgroundColor,
      borderColor: getComputedStyle(card).borderColor,
    })),
  );
  expect(
    new Set(cardColors.map(({ backgroundColor }) => backgroundColor)),
  ).toEqual(new Set(["rgb(255, 255, 255)"]));
  expect(new Set(cardColors.map(({ borderColor }) => borderColor)).size).toBe(
    1,
  );

  await expectAlignedFieldPair(
    page.getByLabel("Ime pošiljatelja"),
    page.getByLabel("E-poštni naslov pošiljatelja"),
    "sender identity fields",
  );
  await expectAlignedFieldPair(
    page.getByLabel("Naslov za odgovore"),
    page.getByLabel("Naslov spletnega mesta"),
    "sender link fields",
  );

  await expect(page.getByTestId("order-email-shared-content")).toHaveCount(0);
  await expect(page.getByText("Skupna vsebina", { exact: true })).toHaveCount(0);

  const desktopViewportMetrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }));
  expect(desktopViewportMetrics.documentWidth).toBeLessThanOrEqual(
    desktopViewportMetrics.viewportWidth + 1,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  const compactTabMask = page
    .getByRole("tab", {
      name: "Osnovne nastavitve",
      exact: true,
      selected: true,
    })
    .locator('[data-eui-tab-divider-mask="true"]');
  await expect(compactTabMask).toBeVisible();
  const compactTabMetrics = await compactTabMask.evaluate((mask) => {
    const activeTab = mask.closest<HTMLElement>('[role="tab"]');
    const tabList = mask.closest<HTMLElement>('[role="tablist"]');
    if (!activeTab || !tabList) {
      throw new Error("The active tab divider mask must remain inside its tab list.");
    }
    const maskStyle = getComputedStyle(mask);
    const activeStyle = getComputedStyle(activeTab);
    const listStyle = getComputedStyle(tabList);
    const maskRect = mask.getBoundingClientRect();
    const activeRect = activeTab.getBoundingClientRect();
    const listRect = tabList.getBoundingClientRect();
    return {
      activeBackground: activeStyle.backgroundColor,
      activeLeft: activeRect.left,
      activeRight: activeRect.right,
      activeWidth: activeRect.width,
      dividerColor: listStyle.borderBottomColor,
      dividerStyle: listStyle.borderBottomStyle,
      dividerWidth: Number.parseFloat(listStyle.borderBottomWidth),
      listBottom: listRect.bottom,
      listWidth: listRect.width,
      maskBackground: maskStyle.backgroundColor,
      maskBottom: maskRect.bottom,
      maskHeight: maskRect.height,
      maskLeft: maskRect.left,
      maskOpacity: Number.parseFloat(maskStyle.opacity),
      maskPosition: maskStyle.position,
      maskRight: maskRect.right,
      maskTop: maskRect.top,
      maskZIndex: Number.parseFloat(maskStyle.zIndex),
    };
  });
  expect(compactTabMetrics.dividerStyle).toBe("solid");
  expect(compactTabMetrics.dividerWidth).toBeGreaterThan(0);
  expect(compactTabMetrics.activeWidth).toBeLessThan(
    compactTabMetrics.listWidth,
  );
  expect(compactTabMetrics.maskBackground).toBe(
    compactTabMetrics.activeBackground,
  );
  expect(compactTabMetrics.maskBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(compactTabMetrics.maskBackground).not.toBe(
    compactTabMetrics.dividerColor,
  );
  expect(compactTabMetrics.maskOpacity).toBe(1);
  expect(compactTabMetrics.maskPosition).toBe("absolute");
  expect(compactTabMetrics.maskZIndex).toBeGreaterThan(0);
  expect(
    Math.abs(compactTabMetrics.maskLeft - compactTabMetrics.activeLeft),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(compactTabMetrics.maskRight - compactTabMetrics.activeRight),
  ).toBeLessThanOrEqual(1);
  expect(compactTabMetrics.maskHeight).toBeGreaterThanOrEqual(
    compactTabMetrics.dividerWidth,
  );
  expect(compactTabMetrics.maskTop).toBeLessThanOrEqual(
    compactTabMetrics.listBottom - compactTabMetrics.dividerWidth + 0.5,
  );
  expect(compactTabMetrics.maskBottom).toBeGreaterThanOrEqual(
    compactTabMetrics.listBottom - 0.5,
  );
  const mobileViewportMetrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }));
  expect(mobileViewportMetrics.documentWidth).toBeLessThanOrEqual(
    mobileViewportMetrics.viewportWidth + 1,
  );
});

test("admin can configure order email settings and templates without sending mail", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const initialResponse = await page.request.get(
    "/api/admin/order-email-settings",
  );
  expect(initialResponse.ok()).toBeTruthy();
  const initialPayload = (await initialResponse.json()) as {
    state: { config: Record<string, unknown> };
  };
  const originalConfig = initialPayload.state.config;
  const initialQuoteResponse = await page.request.get(
    "/api/admin/quote-email-settings",
  );
  expect(initialQuoteResponse.ok()).toBeTruthy();
  const initialQuotePayload = (await initialQuoteResponse.json()) as {
    state: { config: Record<string, unknown> };
  };
  const originalQuoteConfig = initialQuotePayload.state.config;
  const originalQuoteEnabled = originalQuoteConfig.enabled === true;
  const originalQuoteStockAcceptanceMode =
    originalQuoteConfig.stockAcceptanceMode === "automatic"
      ? "automatic"
      : "manual";
  expect(originalQuoteStockAcceptanceMode).toBe("manual");
  let releaseSharedImageUpload!: () => void;
  const sharedImageUploadGate = new Promise<void>((resolve) => {
    releaseSharedImageUpload = resolve;
  });
  let signalSharedImageUploadStarted!: () => void;
  const sharedImageUploadStarted = new Promise<void>((resolve) => {
    signalSharedImageUploadStarted = resolve;
  });
  let authorizedAttachmentPath = "";
  await page.route("**/api/admin/media", async (route) => {
    const body = route.request().postDataJSON() as {
      payload?: { pathname?: unknown };
    };
    authorizedAttachmentPath =
      typeof body.payload?.pathname === "string" ? body.payload.pathname : "";
    expect(authorizedAttachmentPath).not.toBe("");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        presignedUrl: new URL(
          "/__e2e_email_shared_image_upload__",
          route.request().url(),
        ).toString(),
      }),
    });
  });
  await page.route("**/__e2e_email_shared_image_upload__", async (route) => {
    expect(route.request().method()).toBe("PUT");
    signalSharedImageUploadStarted();
    await sharedImageUploadGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: `https://assets.public.blob.vercel-storage.com/${authorizedAttachmentPath}`,
        pathname: authorizedAttachmentPath,
      }),
    });
  });

  try {
    await page.goto("/admin/email");
    await waitForEmailClient(page);

    await expect(
      page.getByRole("heading", { name: "Email", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Email", exact: true }),
    ).toBeVisible();
    const settingsTab = page.getByRole("tab", {
      name: "Osnovne nastavitve",
      exact: true,
    });
    const ordersTab = page.getByRole("tab", {
      name: "Naročila",
      exact: true,
    });
    const quotesTab = page.getByRole("tab", {
      name: "Ponudbe",
      exact: true,
    });
    const emailTabList = page.getByRole("tablist", {
      name: "Razdelki nastavitev e-pošte",
    });
    await expect(emailTabList).toBeVisible();
    await expect(settingsTab).toHaveAttribute("aria-selected", "true");
    await expect(ordersTab).toHaveAttribute("aria-selected", "false");
    await expect(quotesTab).toHaveAttribute("aria-selected", "false");
    await expect(settingsTab).toHaveAttribute(
      "aria-controls",
      "order-email-settings-panel",
    );
    await expect(ordersTab).toHaveAttribute(
      "aria-controls",
      "order-email-orders-panel",
    );
    await expect(quotesTab).toHaveAttribute(
      "aria-controls",
      "order-email-quotes-panel",
    );
    await expect(page.getByTestId("order-email-settings-panel")).toBeVisible();
    await expect(
      page.getByTestId("order-email-settings-panel"),
    ).toHaveAttribute("aria-labelledby", "order-email-tab-settings");
    await expect(page.getByTestId("order-email-orders-panel")).toBeHidden();
    await expect(page.getByTestId("order-email-quotes-panel")).toBeHidden();
    const quoteDeliverySettings = page.getByTestId(
      "quote-email-delivery-settings",
    );
    await expect(quoteDeliverySettings).toBeVisible();
    await expect(
      quoteDeliverySettings.getByRole("heading", {
        name: "Pošiljanje ponudb",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("order-email-quotes-panel")
        .getByText("Pošiljanje ponudb", { exact: true }),
    ).toHaveCount(0);
    const quoteDeliverySwitch = quoteDeliverySettings.getByRole("switch", {
      name: /e-pošto za ponudbe/u,
    });
    await expect(quoteDeliverySwitch).toHaveCount(1);
    await expect(quoteDeliverySwitch).toHaveAttribute(
      "aria-checked",
      String(originalQuoteEnabled),
    );
    const quoteStockPolicy = page.getByTestId("quote-stock-acceptance-policy");
    const quoteStockPolicySwitch = quoteStockPolicy.getByRole("switch");
    await expect(quoteStockPolicy).toBeVisible();
    await expect(quoteStockPolicySwitch).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(quoteStockPolicySwitch).toHaveAccessibleName(
      "Preklopi blokado sprejema zaradi zaloge na samodejni način",
    );
    const combinedSaveStatus = page.getByTestId("order-email-save-status");
    const combinedSaveButton = page.getByTestId("order-email-settings-save");
    await quoteDeliverySwitch.click();
    await expect(quoteDeliverySwitch).toHaveAttribute(
      "aria-checked",
      String(!originalQuoteEnabled),
    );
    await expect(combinedSaveStatus).toHaveText("Neshranjeno");
    await expect(combinedSaveButton).toBeEnabled();
    const quoteSaveResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          "/api/admin/quote-email-settings" &&
        response.request().method() === "PUT",
    );
    await combinedSaveButton.click();
    expect((await quoteSaveResponsePromise).ok()).toBeTruthy();
    await expect(combinedSaveStatus).toHaveText("Shranjeno");
    const persistedQuoteResponse = await page.request.get(
      "/api/admin/quote-email-settings",
    );
    expect(persistedQuoteResponse.ok()).toBeTruthy();
    const persistedQuotePayload = (await persistedQuoteResponse.json()) as {
      state: { config: { enabled?: unknown } };
    };
    expect(persistedQuotePayload.state.config.enabled).toBe(
      !originalQuoteEnabled,
    );
    await quoteDeliverySwitch.click();
    await expect(quoteDeliverySwitch).toHaveAttribute(
      "aria-checked",
      String(originalQuoteEnabled),
    );
    await expect(combinedSaveStatus).toHaveText("Neshranjeno");
    const quoteRestoreResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          "/api/admin/quote-email-settings" &&
        response.request().method() === "PUT",
    );
    await combinedSaveButton.click();
    expect((await quoteRestoreResponsePromise).ok()).toBeTruthy();
    await expect(combinedSaveStatus).toHaveText("Shranjeno");

    await quoteStockPolicySwitch.click();
    await expect(quoteStockPolicySwitch).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(combinedSaveStatus).toHaveText("Neshranjeno");
    const stockPolicySaveResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          "/api/admin/quote-email-settings" &&
        response.request().method() === "PUT",
    );
    await combinedSaveButton.click();
    expect((await stockPolicySaveResponse).ok()).toBeTruthy();
    await expect(combinedSaveStatus).toHaveText("Shranjeno");
    const automaticStockPolicyResponse = await page.request.get(
      "/api/admin/quote-email-settings",
    );
    expect(automaticStockPolicyResponse.ok()).toBeTruthy();
    const automaticStockPolicyPayload =
      (await automaticStockPolicyResponse.json()) as {
        state: { config: { stockAcceptanceMode?: unknown } };
      };
    expect(automaticStockPolicyPayload.state.config.stockAcceptanceMode).toBe(
      "automatic",
    );

    await page.reload();
    await waitForEmailClient(page);
    await expect(settingsTab).toHaveAttribute("aria-selected", "true");
    await expect(quoteStockPolicySwitch).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(quoteStockPolicySwitch).toHaveAccessibleName(
      "Preklopi blokado sprejema zaradi zaloge na ročni način",
    );

    await expect(async () => {
      await ordersTab.click();
      await expect(ordersTab).toHaveAttribute("aria-selected", "true", {
        timeout: 250,
      });
    }).toPass({ timeout: 5_000 });
    await settingsTab.click();
    await expect(settingsTab).toHaveAttribute("aria-selected", "true");
    await settingsTab.focus();
    await settingsTab.press("ArrowRight");
    await expect(ordersTab).toBeFocused();
    await expect(ordersTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("order-email-orders-panel")).toBeVisible();
    await ordersTab.press("Home");
    await expect(settingsTab).toBeFocused();
    await expect(settingsTab).toHaveAttribute("aria-selected", "true");
    await settingsTab.press("End");
    await expect(quotesTab).toBeFocused();
    await expect(quotesTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("order-email-quotes-panel")).toBeVisible();
    const quoteEventTable = page.getByTestId("quote-email-event-table");
    await expect(quoteEventTable).toBeVisible();
    const quoteSectionOrder = await page
      .locator(
        '[data-testid="quote-email-event-grid"], [data-testid="quote-email-message-templates"], [data-testid="quote-email-queue-card"]',
      )
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-testid")),
      );
    expect(quoteSectionOrder).toEqual([
      "quote-email-event-grid",
      "quote-email-message-templates",
      "quote-email-queue-card",
    ]);
    await expect(
      page
        .getByTestId("quote-email-queue-card")
        .getByRole("heading", { name: "Čakalna vrsta ponudb", exact: true }),
    ).toBeVisible();
    for (const column of ["Dogodek", "Stranka", "Administratorji"]) {
      await expect(
        quoteEventTable.getByRole("columnheader", {
          name: column,
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(
      quoteEventTable.getByRole("columnheader", {
        name: "Predloga",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Ko administrator izda ponudbo in jo pošlje stranki.", {
        exact: true,
      }),
    ).toBeVisible();

    const quoteIssuedRow = page.getByTestId(
      "quote-email-event-row-quote_issued",
    );
    const quoteAcceptedRow = page.getByTestId(
      "quote-email-event-row-quote_accepted",
    );
    const quoteDeclinedRow = page.getByTestId(
      "quote-email-event-row-quote_declined",
    );
    const quoteExpiredRow = page.getByTestId(
      "quote-email-event-row-quote_expired",
    );
    await expect(quoteIssuedRow).toHaveAttribute("data-status-tone", "info");
    await expect(quoteAcceptedRow).toHaveAttribute(
      "data-status-tone",
      "success",
    );
    await expect(quoteDeclinedRow).toHaveAttribute(
      "data-status-tone",
      "danger",
    );
    await expect(quoteExpiredRow).toHaveAttribute(
      "data-status-tone",
      "warning",
    );
    const quoteRowBackgrounds = await Promise.all(
      [quoteIssuedRow, quoteAcceptedRow, quoteDeclinedRow, quoteExpiredRow].map(
        (row) =>
          row.evaluate((element) => getComputedStyle(element).backgroundColor),
      ),
    );
    expect(new Set(quoteRowBackgrounds).size).toBe(4);

    const quoteTemplateEvent = page.getByLabel("Dogodek ponudbe");
    const quoteTemplateSection = page.getByTestId(
      "quote-email-message-templates",
    );
    const initialQuoteTemplateBackground = await quoteTemplateSection.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await selectCustomOption(page, quoteTemplateEvent, "Ponudba izdana");
    await expect(
      page.getByRole("heading", { name: "Predloge sporočil", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("quote-email-template-customer"),
    ).toBeVisible();
    const issuedQuoteTemplateBackground = await quoteTemplateSection.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(issuedQuoteTemplateBackground).toBe(initialQuoteTemplateBackground);
    await selectCustomOption(page, quoteTemplateEvent, "Ponudba sprejeta");
    const acceptedQuoteTemplateBackground = await quoteTemplateSection.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await selectCustomOption(page, quoteTemplateEvent, "Ponudba zavrnjena");
    const declinedQuoteTemplateBackground = await quoteTemplateSection.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(acceptedQuoteTemplateBackground).toBe(initialQuoteTemplateBackground);
    expect(declinedQuoteTemplateBackground).toBe(initialQuoteTemplateBackground);
    await expect(quoteTemplateSection).not.toHaveAttribute("data-status-tone");
    await selectCustomOption(page, quoteTemplateEvent, "Povpraševanje prejeto");
    const quoteCustomerTab = quoteTemplateSection.getByRole("tab", {
      name: "Fiz. oseba",
      exact: true,
    });
    const quoteCompanyTab = quoteTemplateSection.getByRole("tab", {
      name: "Podjetje",
      exact: true,
    });
    const quoteSchoolTab = quoteTemplateSection.getByRole("tab", {
      name: "Šola / javni zavod",
      exact: true,
    });
    const quoteAdminTab = quoteTemplateSection.getByRole("tab", {
      name: "Admin",
      exact: true,
    });
    await expectAudienceTabsWithoutVerticalScroll(quoteTemplateSection);
    await expect(quoteCustomerTab).toHaveAttribute("aria-selected", "true");
    await expect(quoteCompanyTab).toBeVisible();
    await expect(quoteSchoolTab).toBeVisible();
    await expect(quoteAdminTab).toHaveAttribute("aria-selected", "false");
    await quoteCompanyTab.click();
    await expect(
      page.getByTestId("quote-email-template-companyCustomer"),
    ).toBeVisible();
    await quoteSchoolTab.click();
    await expect(
      page.getByTestId("quote-email-template-schoolCustomer"),
    ).toBeVisible();
    await quoteCustomerTab.click();
    const quoteCustomerEvent = page.getByTestId(
      "quote-email-event-quote_request_submitted-customer",
    );
    const quoteAdminEvent = page.getByTestId(
      "quote-email-event-quote_request_submitted-admins",
    );
    const quoteCustomerDelivery = page.getByTestId(
      "quote-email-template-recipient-customer",
    );
    const quoteAdminDelivery = page.getByTestId(
      "quote-email-template-recipient-admin",
    );
    const originalQuoteCustomerDelivery = await quoteCustomerEvent.isChecked();
    const originalQuoteAdminDelivery = await quoteAdminEvent.isChecked();
    await expect(quoteCustomerDelivery).toHaveAttribute(
      "aria-checked",
      String(originalQuoteCustomerDelivery),
    );
    await expect(quoteAdminDelivery).toHaveAttribute(
      "aria-checked",
      String(originalQuoteAdminDelivery),
    );
    await expect(
      page.getByTestId("quote-email-message-templates-activity"),
    ).toHaveText(
      /^(Aktivno|Delno aktivno|Neaktivno|Začasno izklopljeno)$/u,
    );
    await quoteCustomerDelivery.click();
    await expect(quoteCustomerEvent).toBeChecked({
      checked: !originalQuoteCustomerDelivery,
    });
    await expect(quoteCustomerDelivery).toHaveAttribute(
      "aria-checked",
      String(!originalQuoteCustomerDelivery),
    );
    await quoteCustomerDelivery.click();
    await expect(quoteCustomerEvent).toBeChecked({
      checked: originalQuoteCustomerDelivery,
    });
    const quoteCustomerTemplate = page.getByTestId(
      "quote-email-template-customer",
    );
    await expect(quoteCustomerTemplate).toBeVisible();
    const quoteCustomerSubject = await openEmailSubjectEditor(
      page,
      "quote-email-preview",
    );
    const quoteCustomerSubjectValue = await quoteCustomerSubject.inputValue();
    const quoteCustomerContentValue = {
      greeting: "E2E pozdrav za fizično osebo s povpraševanjem.",
      heading: "E2E ponudba za fizično osebo",
      body: "E2E vsebina za fizično osebo.",
    };
    const quoteCustomerEditor = await openEmailContentEditor(
      page,
      "quote-email-preview",
      "quote-email-template",
    );
    await replaceRichEmailContent(
      page,
      quoteCustomerEditor.editor,
      quoteCustomerContentValue,
    );
    const quoteCustomerVariables = page
      .getByTestId("quote-email-preview-editor-toolbar")
      .getByLabel("Dovoljene spremenljivke", { exact: true });
    await expect(
      quoteCustomerVariables.getByText("{{quote_code}}", { exact: true }),
    ).toBeVisible();
    for (const internalVariable of [
      "{{request_number}}", "{{offer_number}}", "{{order_number}}",
    ]) {
      await expect(
        quoteCustomerVariables.getByText(internalVariable, { exact: true }),
      ).toHaveCount(0);
    }
    const quotePreviewFrame = page.getByTestId("quote-email-preview-frame");
    const quotePreview = page.frameLocator(
      '[data-testid="quote-email-preview-frame"]',
    );
    const quotePreviewViewport = page.getByTestId(
      "quote-email-preview-viewport",
    );
    const quotePreviewStage = page.getByTestId("quote-email-preview-stage");
    const quoteZoomReset = page.getByTestId("quote-email-preview-zoom-reset");
    await expect(quotePreviewViewport).toHaveAttribute("tabindex", "0");
    await expect(quoteZoomReset).toHaveText("90 %");
    const initialQuotePreviewWidth = await quotePreviewStage.evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    await page.getByTestId("quote-email-preview-zoom-in").click();
    await expect(quoteZoomReset).toHaveText("100 %");
    await expect
      .poll(() =>
        quotePreviewStage.evaluate(
          (element) => element.getBoundingClientRect().width,
        ),
      )
      .toBeGreaterThan(initialQuotePreviewWidth + 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(quoteZoomReset).toHaveText("100 %");
    await page.getByTestId("quote-email-preview-zoom-out").click();
    await expect(quoteZoomReset).toHaveText("90 %");
    await quoteZoomReset.click();
    await expect(quoteZoomReset).toHaveText("100 %");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(quoteZoomReset).toHaveText("90 %");
    await expect(
      quotePreview.getByText(quoteCustomerContentValue.greeting, { exact: true }),
    ).toBeVisible();
    await expect(
      quotePreview.getByRole("heading", {
        level: 1,
        name: quoteCustomerContentValue.heading,
        exact: true,
      }),
    ).toBeVisible();
    await expect(quotePreviewFrame).toHaveAttribute("scrolling", "no");
    await quoteAdminTab.click();
    await expect(quoteAdminTab).toHaveAttribute("aria-selected", "true");
    await expect(quoteCustomerTemplate).toHaveCount(0);
    const quoteAdminTemplate = page.getByTestId("quote-email-template-admin");
    await expect(quoteAdminTemplate).toBeVisible();
    const quoteAdminSubjectValue =
      "E2E – Novo povpraševanje {{request_number}}";
    const quoteAdminContentValue = {
      greeting: "E2E pozdrav za administratorja ponudbe.",
      heading: "E2E novo povpraševanje za pregled",
      body: "E2E administratorska vsebina za povpraševanje {{request_number}}.",
    };
    const quoteAdminSubject = await openEmailSubjectEditor(
      page,
      "quote-email-preview",
    );
    await quoteAdminSubject.fill(quoteAdminSubjectValue);
    const quoteAdminEditor = await openEmailContentEditor(
      page,
      "quote-email-preview",
      "quote-email-template",
    );
    await replaceRichEmailContent(
      page,
      quoteAdminEditor.editor,
      quoteAdminContentValue,
    );
    await expect(page.getByTestId("quote-email-preview-subject")).toContainText(
      "E2E",
    );
    await expect(
      quotePreview.getByText(quoteAdminContentValue.greeting, { exact: true }),
    ).toBeVisible();
    await expect(
      quotePreview.getByRole("heading", {
        level: 1,
        name: quoteAdminContentValue.heading,
        exact: true,
      }),
    ).toBeVisible();
    await quoteCustomerTab.click();
    await expect(await openEmailSubjectEditor(page, "quote-email-preview")).toHaveValue(
      quoteCustomerSubjectValue,
    );
    await quoteAdminTab.click();
    await openEmailContentEditor(
      page,
      "quote-email-preview",
      "quote-email-template",
    );
    const quoteAdminVariables = page
      .getByTestId("quote-email-preview-editor-toolbar")
      .getByLabel("Dovoljene spremenljivke", { exact: true });
    await expect(
      quoteAdminVariables.getByText("{{request_number}}", { exact: true }),
    ).toBeVisible();
    await expect(
      quoteAdminVariables.getByText("{{quote_code}}", { exact: true }),
    ).toBeVisible();
    for (const unavailableVariable of [
      "{{offer_number}}", "{{offer_code}}", "{{order_code}}",
    ]) {
      await expect(
        quoteAdminVariables.getByText(unavailableVariable, { exact: true }),
      ).toHaveCount(0);
    }
    await expect(page.getByTestId("order-email-shared-content")).toHaveCount(0);
    const quoteSaveButton = page.getByTestId("quote-email-settings-save");
    const quoteSaveStatus = page.getByTestId("quote-email-save-status");
    await expect(quoteSaveButton).toBeVisible();
    await expect(quoteSaveButton).toHaveText("Shrani spremembe");
    await expect(quoteSaveButton).toBeEnabled();
    await expect(quoteSaveStatus).toHaveText("Neshranjeno");
    const quoteAdminSaveResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          "/api/admin/quote-email-settings" &&
        response.request().method() === "PUT",
    );
    await quoteSaveButton.click();
    expect((await quoteAdminSaveResponse).ok()).toBeTruthy();
    await expect(quoteSaveStatus).toHaveText("Shranjeno");
    await expect(quoteSaveButton).toBeDisabled();

    await page.reload();
    await waitForEmailClient(page);
    await quotesTab.click();
    await selectCustomOption(
      page,
      page.getByLabel("Dogodek ponudbe"),
      "Povpraševanje prejeto",
    );
    await page
      .getByTestId("quote-email-message-templates")
      .getByRole("tab", { name: "Admin", exact: true })
      .click();
    await expect(page.getByTestId("quote-email-template-admin")).toBeVisible();
    await expect(
      await openEmailSubjectEditor(page, "quote-email-preview"),
    ).toHaveValue(quoteAdminSubjectValue);
    const persistedQuoteAdminEditor = await openEmailContentEditor(
      page,
      "quote-email-preview",
      "quote-email-template",
    );
    await expectRichEmailContent(
      persistedQuoteAdminEditor.editor,
      quoteAdminContentValue,
    );
    await page
      .getByTestId("quote-email-message-templates")
      .getByRole("tab", { name: "Fiz. oseba", exact: true })
      .click();
    await expect(await openEmailSubjectEditor(page, "quote-email-preview")).toHaveValue(
      quoteCustomerSubjectValue,
    );
    const persistedQuoteCustomerEditor = await openEmailContentEditor(
      page,
      "quote-email-preview",
      "quote-email-template",
    );
    await expectRichEmailContent(
      persistedQuoteCustomerEditor.editor,
      quoteCustomerContentValue,
    );
    const persistedQuoteCustomerEvent = page.getByTestId(
      "quote-email-event-quote_request_submitted-customer",
    );
    const originalQuoteCustomerEvent =
      await persistedQuoteCustomerEvent.isChecked();
    await persistedQuoteCustomerEvent.setChecked(!originalQuoteCustomerEvent);
    await expect(quoteSaveStatus).toHaveText("Neshranjeno");
    await expect(quoteSaveButton).toBeEnabled();
    await persistedQuoteCustomerEvent.setChecked(originalQuoteCustomerEvent);
    await expect(quoteSaveStatus).toHaveText("Shranjeno");
    await expect(quoteSaveButton).toBeDisabled();
    await expect(page.getByTestId("order-email-settings-save")).toHaveCount(0);
    await quotesTab.press("ArrowLeft");
    await expect(ordersTab).toBeFocused();
    await expect(ordersTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("order-email-settings-save")).toBeVisible();
    await ordersTab.press("ArrowLeft");
    await expect(settingsTab).toBeFocused();
    await expect(settingsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("order-email-settings-panel")).toBeVisible();

    await expect(
      page.getByText("Pošiljanje je v E2E izklopljeno"),
    ).toBeVisible();
    const saveButton = page.getByTestId("order-email-settings-save");
    const senderName = page.getByLabel("Ime po\u0161iljatelja");
    const fromAddress = page.getByLabel(
      "E-po\u0161tni naslov po\u0161iljatelja",
    );
    const replyTo = page.getByLabel("Naslov za odgovore");
    const siteUrl = page.getByLabel("Naslov spletnega mesta");
    await expectAlignedFieldPair(
      senderName,
      fromAddress,
      "Sender identity fields",
    );
    await expectAlignedFieldPair(
      replyTo,
      siteUrl,
      "Reply-to and site URL fields",
    );
    await expectSharpAdminFocus(replyTo);
    const originalSiteUrl = await siteUrl.inputValue();
    await expect(page.getByTestId("order-email-shared-content")).toHaveCount(0);
    await ordersTab.click();
    const contextualSubject = await openEmailSubjectEditor(
      page,
      "order-email-preview",
    );
    await expect(contextualSubject).toBeVisible();
    const contextToolbar = page.getByTestId("order-email-preview-editor-toolbar");
    const contextualPrefix = contextToolbar.getByLabel(
      "Predpona · skupno za naročila in ponudbe",
      { exact: true },
    );
    await expect(contextualPrefix).toBeVisible();
    const originalPrefix = await contextualPrefix.inputValue();
    await contextualPrefix.fill(`${originalPrefix} E2E`);
    await contextualPrefix.fill(originalPrefix);
    await contextToolbar
      .getByRole("button", { name: "Skupna slikovna priponka" })
      .click();
    const imageAttachmentInput = contextToolbar.getByLabel(
      "Slikovna priponka",
      { exact: true },
    );
    await expect(imageAttachmentInput).toHaveCount(1);
    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nJ8AAAAASUVORK5CYII=",
      "base64",
    );
    await imageAttachmentInput.setInputFiles({
      name: "e2e-shared.png",
      mimeType: "image/png",
      buffer: imageBytes,
    });
    await expect(
      contextToolbar.getByText("e2e-shared.png", { exact: true }),
    ).toBeVisible();
    const sendTestButton = page.getByTestId("order-email-send-test");
    await expect(sendTestButton).toBeDisabled();
    await expect(saveButton).toBeEnabled();
    const attachmentSaveResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          "/api/admin/order-email-settings" &&
        response.request().method() === "PUT",
    );
    await saveButton.click();
    await sharedImageUploadStarted;
    await expect(saveButton).toBeDisabled();
    await expect(sendTestButton).toBeDisabled();
    releaseSharedImageUpload();
    expect((await attachmentSaveResponse).ok()).toBeTruthy();
    await expect(saveButton).toBeDisabled();
    await expect(sendTestButton).toBeEnabled();
    const attachmentConfigResponse = await page.request.get(
      "/api/admin/order-email-settings",
    );
    expect(attachmentConfigResponse.ok()).toBeTruthy();
    const attachmentConfigPayload = (await attachmentConfigResponse.json()) as {
      state: { config: { imageAttachment?: unknown } };
    };
    expect(attachmentConfigPayload.state.config.imageAttachment).toEqual(
      expect.objectContaining({
        url: `https://assets.public.blob.vercel-storage.com/${authorizedAttachmentPath}`,
        pathname: authorizedAttachmentPath,
        filename: "e2e-shared.png",
        contentType: "image/png",
        size: imageBytes.length,
      }),
    );

    await settingsTab.click();
    await siteUrl.fill("not-a-valid-url");
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Spletni naslov" }).first(),
    ).toBeVisible();
    await expect(siteUrl).toHaveAttribute("aria-invalid", "true");
    await siteUrl.fill(originalSiteUrl);

    let testRequestBody:
      | {
          recipient?: unknown;
          config?: Record<string, unknown>;
        }
      | undefined;
    await page.route(
      "**/api/admin/order-email-settings/test",
      async (route) => {
        testRequestBody = route.request().postDataJSON() as {
          recipient?: unknown;
          config?: Record<string, unknown>;
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Testno sporočilo je prestreženo v E2E.",
          }),
        });
      },
    );
    await settingsTab.click();
    await expect(page.getByTestId("order-email-test-delivery")).toBeVisible();
    const testRecipient = page.getByLabel("Prejemnik testa");
    await testRecipient.fill("e2e-test@example.com");
    await testRecipient.press("Enter");
    await expect(
      page.getByText("Testno sporočilo je prestreženo v E2E."),
    ).toBeVisible();
    expect(testRequestBody).toMatchObject({
      recipient: "e2e-test@example.com",
    });
    expect(testRequestBody?.config).toEqual(
      expect.objectContaining({ siteUrl: originalSiteUrl }),
    );
    const serializedTestRequest = JSON.stringify(testRequestBody);
    expect(serializedTestRequest).not.toContain("RESEND_API_KEY");
    expect(serializedTestRequest).not.toContain("apiKey");

    await ordersTab.click();
    await expect(page.getByTestId("order-email-orders-panel")).toBeVisible();
    await expect(
      page.getByTestId("order-email-event-order_submitted-customer"),
    ).toBeChecked();
    await expect(
      page.getByTestId("order-email-event-in_progress-admins"),
    ).toBeChecked();
    const orderSectionOrder = await page
      .locator(
        '[data-testid="order-email-event-matrix"], [data-testid="order-email-message-templates"], [data-testid="order-email-queue"]',
      )
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-testid")),
      );
    expect(orderSectionOrder).toEqual([
      "order-email-event-matrix",
      "order-email-message-templates",
      "order-email-queue",
    ]);
    const orderTemplates = page.getByTestId("order-email-message-templates");
    await expect(orderTemplates.getByLabel("Predpona zadeve")).toHaveCount(0);
    await expect(
      orderTemplates.getByLabel("Dodatno besedilo v nogi"),
    ).toHaveCount(0);
    await expect(
      orderTemplates.getByTestId("order-email-shared-content"),
    ).toHaveCount(0);
    await expect(
      page
        .getByTestId("order-email-queue")
        .getByRole("heading", { name: "Čakalna vrsta naročil", exact: true }),
    ).toBeVisible();

    await settingsTab.click();
    await page.getByRole("button", { name: "Dodaj naslov" }).click();
    const recipient = page
      .getByLabel(/E-poštni naslov administratorja/u)
      .last();
    await recipient.fill("  E2E-ORDER-EMAIL@EXAMPLE.COM  ");

    await ordersTab.click();
    const orderEventTable = page.getByTestId("order-email-event-table");
    await expect(orderEventTable).toBeVisible();
    const orderInProgressRow = page.getByTestId(
      "order-email-event-row-in_progress",
    );
    const orderSentRow = page.getByTestId("order-email-event-row-sent");
    const orderFinishedRow = page.getByTestId("order-email-event-row-finished");
    const orderCancelledRow = page.getByTestId(
      "order-email-event-row-cancelled",
    );
    await expect(orderInProgressRow).toHaveAttribute(
      "data-status-tone",
      "warning",
    );
    await expect(orderSentRow).toHaveAttribute("data-status-tone", "info");
    await expect(orderFinishedRow).toHaveAttribute(
      "data-status-tone",
      "success",
    );
    await expect(orderCancelledRow).toHaveAttribute(
      "data-status-tone",
      "danger",
    );
    const orderRowBackgrounds = await Promise.all(
      [
        orderInProgressRow,
        orderSentRow,
        orderFinishedRow,
        orderCancelledRow,
      ].map((row) =>
        row.evaluate((element) => getComputedStyle(element).backgroundColor),
      ),
    );
    expect(new Set(orderRowBackgrounds).size).toBe(4);

    const templateEvent = page.getByLabel("Dogodek naročila");
    const orderTemplateSection = page.getByTestId(
      "order-email-message-templates",
    );
    const initialOrderTemplateBackground = await orderTemplateSection.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await selectCustomOption(page, templateEvent, "V obdelavi");
    const inProgressTemplateBackground = await orderTemplateSection.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await selectCustomOption(page, templateEvent, "Zaključeno");
    const finishedTemplateBackground = await orderTemplateSection.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await selectCustomOption(page, templateEvent, "Preklicano");
    const cancelledTemplateBackground = await orderTemplateSection.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(inProgressTemplateBackground).toBe(initialOrderTemplateBackground);
    expect(finishedTemplateBackground).toBe(initialOrderTemplateBackground);
    expect(cancelledTemplateBackground).toBe(initialOrderTemplateBackground);
    await expect(orderTemplateSection).not.toHaveAttribute("data-status-tone");
    await selectCustomOption(page, templateEvent, "Naročilo prejeto");

    const submittedCustomerEvent = page.getByTestId(
      "order-email-event-order_submitted-customer",
    );
    const submittedAdminEvent = page.getByTestId(
      "order-email-event-order_submitted-admins",
    );
    const orderCustomerDelivery = page.getByTestId(
      "order-email-template-recipient-customer",
    );
    const orderAdminDelivery = page.getByTestId(
      "order-email-template-recipient-admin",
    );
    const originalSubmittedCustomer = await submittedCustomerEvent.isChecked();
    const originalSubmittedAdmin = await submittedAdminEvent.isChecked();
    await expect(orderCustomerDelivery).toHaveAttribute(
      "aria-checked",
      String(originalSubmittedCustomer),
    );
    await expect(orderAdminDelivery).toHaveAttribute(
      "aria-checked",
      String(originalSubmittedAdmin),
    );
    await expect(
      page.getByTestId("order-email-message-templates-activity"),
    ).toHaveText(
      /^(Aktivno|Delno aktivno|Neaktivno|Začasno izklopljeno)$/u,
    );
    await orderAdminDelivery.click();
    await expect(submittedAdminEvent).toBeChecked({
      checked: !originalSubmittedAdmin,
    });
    await expect(orderAdminDelivery).toHaveAttribute(
      "aria-checked",
      String(!originalSubmittedAdmin),
    );
    await orderAdminDelivery.click();
    await expect(submittedAdminEvent).toBeChecked({
      checked: originalSubmittedAdmin,
    });

    const finishedCustomer = page.getByTestId(
      "order-email-event-finished-customer",
    );
    const originalFinishedCustomer = await finishedCustomer.isChecked();
    await finishedCustomer.setChecked(!originalFinishedCustomer);

    await expect(ordersTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("order-email-orders-panel")).toBeVisible();
    await selectCustomOption(page, templateEvent, "Naročilo prejeto");
    const orderCustomerTab = orderTemplateSection.getByRole("tab", {
      name: "Fiz. oseba",
      exact: true,
    });
    const orderCompanyTab = orderTemplateSection.getByRole("tab", {
      name: "Podjetje",
      exact: true,
    });
    const orderSchoolTab = orderTemplateSection.getByRole("tab", {
      name: "Šola / javni zavod",
      exact: true,
    });
    const orderAdminTab = orderTemplateSection.getByRole("tab", {
      name: "Admin",
      exact: true,
    });
    await expectAudienceTabsWithoutVerticalScroll(orderTemplateSection);
    await expect(orderCustomerTab).toHaveAttribute("aria-selected", "true");
    await expect(orderCompanyTab).toBeVisible();
    await expect(orderSchoolTab).toBeVisible();
    await expect(orderAdminTab).toBeVisible();
    await orderCompanyTab.click();
    await expect(
      page.getByTestId("order-email-template-company-customer"),
    ).toBeVisible();
    await orderSchoolTab.click();
    const schoolCustomerCard = page.getByTestId(
      "order-email-template-school-customer",
    );
    await expect(schoolCustomerCard).toBeVisible();
    await expect(
      page.getByTestId("order-email-template-individual-customer"),
    ).toHaveCount(0);

    const schoolCustomerSubjectValue =
      "E2E – Vaše šolsko naročilo je bilo prejeto";
    const schoolCustomerContentValue = {
      greeting: "E2E pozdrav za šolo ali javni zavod.",
      heading: "E2E šolsko naročilo je sprejeto",
      body: "E2E navodila za varno nalaganje naročilnice.",
    };
    let schoolCustomerSubject = await openEmailSubjectEditor(
      page,
      "order-email-preview",
    );
    await schoolCustomerSubject.fill("Začasna šolska zadeva");
    let schoolCustomerEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    await replaceRichEmailContent(page, schoolCustomerEditor.editor, {
      greeting: "Začasen šolski pozdrav",
      heading: "Začasen šolski naslov",
      body: "Začasna šolska vsebina",
    });
    await page
      .getByRole("button", {
        name: "Ponastavi privzeto predlogo za šolo ali javni zavod",
      })
      .click();
    schoolCustomerSubject = await openEmailSubjectEditor(
      page,
      "order-email-preview",
    );
    await expect(schoolCustomerSubject).not.toHaveValue(
      "Začasna šolska zadeva",
    );
    await schoolCustomerSubject.fill(schoolCustomerSubjectValue);
    schoolCustomerEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    await replaceRichEmailContent(
      page,
      schoolCustomerEditor.editor,
      schoolCustomerContentValue,
    );
    const orderPreviewFrame = page.getByTestId("order-email-preview-frame");
    const orderPreview = page.frameLocator(
      '[data-testid="order-email-preview-frame"]',
    );
    await expect(
      orderPreview.getByText(schoolCustomerContentValue.greeting, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      orderPreview.getByRole("heading", {
        level: 1,
        name: schoolCustomerContentValue.heading,
        exact: true,
      }),
    ).toBeVisible();
    await expect(orderPreviewFrame).toHaveAttribute("scrolling", "no");

    const schoolCustomerVariables = page
      .getByTestId("order-email-preview-editor-toolbar")
      .getByLabel("Dovoljene spremenljivke", { exact: true });
    await expect(
      schoolCustomerVariables.getByText("{{organization_name}}", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      schoolCustomerVariables.getByText("{{contact_name}}", { exact: true }),
    ).toBeVisible();
    await expect(
      schoolCustomerVariables.getByText("{{reference}}", { exact: true }),
    ).toBeVisible();
    await expect(
      schoolCustomerVariables.getByText("{{order_number}}"),
    ).toHaveCount(0);
    await selectCustomOption(page, templateEvent, "V obdelavi");
    await expect(
      page.getByTestId("order-email-template-school-customer"),
    ).toBeVisible();
    await expect(orderSchoolTab).toBeVisible();
    await selectCustomOption(page, templateEvent, "Naročilo prejeto");
    schoolCustomerSubject = await openEmailSubjectEditor(
      page,
      "order-email-preview",
    );
    await expect(schoolCustomerSubject).toHaveValue(schoolCustomerSubjectValue);
    schoolCustomerEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    await expectRichEmailContent(
      schoolCustomerEditor.editor,
      schoolCustomerContentValue,
    );

    const customerSubjectValue = "E2E – Vaše naročilo je bilo prejeto";
    const customerContentValue = {
      greeting: "E2E pozdrav za fizično osebo.",
      heading: "E2E potrditev prejema naročila",
      body: "E2E vsebina za fizično osebo brez interne številke.",
    };
    const adminSubjectValue = "E2E – Novo naročilo";
    const adminContentValue = {
      greeting: "E2E pozdrav za administratorja naročila.",
      heading: "E2E novo naročilo za pregled",
      body: "E2E vsebina za administratorja.",
    };
    await orderCustomerTab.click();
    const orderCustomerTemplate = page.getByTestId(
      "order-email-template-individual-customer",
    );
    await expect(orderCustomerTemplate).toBeVisible();
    let customerSubject = await openEmailSubjectEditor(
      page,
      "order-email-preview",
    );
    await expectSharpAdminFocus(customerSubject);

    await customerSubject.fill(customerSubjectValue);
    let customerEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    let customerContent = customerEditor.editor;
    await replaceRichEmailContent(page, customerContent, customerContentValue);
    await expect(
      orderPreview.getByText(customerContentValue.greeting, { exact: true }),
    ).toBeVisible();
    await expect(
      orderPreview.getByRole("heading", {
        level: 1,
        name: customerContentValue.heading,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByTestId("order-email-template-individual-customer-reset"),
    ).toBeVisible();
    await orderAdminTab.click();
    const orderAdminTemplate = page.getByTestId("order-email-template-admin");
    await expect(orderAdminTemplate).toBeVisible();
    let adminSubject = await openEmailSubjectEditor(
      page,
      "order-email-preview",
    );
    await adminSubject.fill(adminSubjectValue);
    let adminEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    let adminContent = adminEditor.editor;
    await replaceRichEmailContent(page, adminContent, adminContentValue);
    await expect(page.getByTestId("order-email-preview-subject")).toContainText(
      "E2E",
    );
    await expect(
      orderPreview.getByText(adminContentValue.greeting, { exact: true }),
    ).toBeVisible();
    await expect(
      orderPreview.getByRole("heading", {
        level: 1,
        name: adminContentValue.heading,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByTestId("order-email-template-admin-reset"),
    ).toBeVisible();
    await orderCustomerTab.click();

    await settingsTab.click();
    await expect(page.getByTestId("order-email-settings-panel")).toBeVisible();
    await ordersTab.click();
    customerSubject = await openEmailSubjectEditor(page, "order-email-preview");
    await expect(customerSubject).toHaveValue(customerSubjectValue);
    customerEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    customerContent = customerEditor.editor;
    await expectRichEmailContent(customerContent, customerContentValue);
    await orderAdminTab.click();
    adminSubject = await openEmailSubjectEditor(page, "order-email-preview");
    await expect(adminSubject).toHaveValue(adminSubjectValue);
    adminEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    adminContent = adminEditor.editor;
    await expectRichEmailContent(adminContent, adminContentValue);
    await orderCustomerTab.click();
    customerEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    customerContent = customerEditor.editor;

    let releaseDelayedSave!: () => void;
    const delayedSaveGate = new Promise<void>((resolve) => {
      releaseDelayedSave = resolve;
    });
    let signalDelayedSaveStarted!: () => void;
    const delayedSaveStarted = new Promise<void>((resolve) => {
      signalDelayedSaveStarted = resolve;
    });
    let delayNextSettingsSave = true;
    await page.route("**/api/admin/order-email-settings", async (route) => {
      if (route.request().method() !== "PUT" || !delayNextSettingsSave) {
        await route.continue();
        return;
      }
      delayNextSettingsSave = false;
      signalDelayedSaveStarted();
      await delayedSaveGate;
      await route.continue();
    });

    await saveButton.click();
    await delayedSaveStarted;
    customerEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    customerContent = customerEditor.editor;
    const customerContentAfterSaveStarted = {
      ...customerContentValue,
      body: "E2E novejša vsebina, vnesena med shranjevanjem.",
    };
    const customerBodyNode = customerContent.locator(":scope > p").last();
    await customerBodyNode.selectText();
    await page.keyboard.insertText(customerContentAfterSaveStarted.body);
    releaseDelayedSave();
    await expect(
      page.getByText("Nastavitve samodejne e-pošte so shranjene."),
    ).toBeVisible();
    await expectRichEmailContent(
      customerContent,
      customerContentAfterSaveStarted,
    );
    await expect(saveButton).toBeEnabled();

    const persistedSaveResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/admin/order-email-settings") &&
        response.request().method() === "PUT",
    );
    await saveButton.click();
    expect((await persistedSaveResponse).ok()).toBeTruthy();
    await expect(page.getByTestId("order-email-save-status")).toHaveText(
      "Shranjeno",
    );
    await expect(saveButton).toHaveText("Shrani spremembe");
    await expect(saveButton).toBeDisabled();

    await page.reload();
    await waitForEmailClient(page);
    await expect(
      page.locator('input[value="e2e-order-email@example.com"]'),
    ).toBeVisible();
    await expect(
      page.getByTestId("order-email-event-finished-customer"),
    ).toBeChecked({ checked: !originalFinishedCustomer });

    await expect(async () => {
      await ordersTab.click();
      await expect(ordersTab).toHaveAttribute("aria-selected", "true", {
        timeout: 250,
      });
    }).toPass({ timeout: 5_000 });
    await selectCustomOption(
      page,
      page.getByLabel("Dogodek naročila"),
      "Naročilo prejeto",
    );
    customerSubject = await openEmailSubjectEditor(page, "order-email-preview");
    await expect(customerSubject).toHaveValue(customerSubjectValue);
    customerEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    customerContent = customerEditor.editor;
    await expectRichEmailContent(
      customerContent,
      customerContentAfterSaveStarted,
    );
    await page
      .getByTestId("order-email-message-templates")
      .getByRole("tab", { name: "Šola / javni zavod", exact: true })
      .click();
    schoolCustomerSubject = await openEmailSubjectEditor(
      page,
      "order-email-preview",
    );
    await expect(schoolCustomerSubject).toHaveValue(schoolCustomerSubjectValue);
    schoolCustomerEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    await expectRichEmailContent(
      schoolCustomerEditor.editor,
      schoolCustomerContentValue,
    );
    await page
      .getByTestId("order-email-message-templates")
      .getByRole("tab", { name: "Admin", exact: true })
      .click();
    adminSubject = await openEmailSubjectEditor(page, "order-email-preview");
    await expect(adminSubject).toHaveValue(adminSubjectValue);
    adminEditor = await openEmailContentEditor(
      page,
      "order-email-preview",
      "order-email-template",
    );
    await expectRichEmailContent(
      adminEditor.editor,
      adminContentValue,
    );
    await page
      .getByTestId("order-email-message-templates")
      .getByRole("tab", { name: "Fiz. oseba", exact: true })
      .click();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(settingsTab).toBeVisible();
    await expect(ordersTab).toBeVisible();
    await expect(quotesTab).toBeVisible();
    const viewportMetrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ),
    }));
    expect(viewportMetrics.documentWidth).toBeLessThanOrEqual(
      viewportMetrics.viewportWidth + 1,
    );

    const customerTemplateCard = page.getByTestId(
      "order-email-template-individual-customer",
    );
    await expect(customerTemplateCard).toBeVisible();
    await expect(orderPreviewFrame).toHaveAttribute("scrolling", "no");
    await expect(page.getByTestId("order-email-template-admin")).toHaveCount(0);
    await expect(
      page.getByTestId("order-email-template-school-customer"),
    ).toHaveCount(0);
    const orderPreviewPanel = page.getByTestId("order-email-preview");
    const [customerCardBox, previewBox] = await Promise.all([
      requireBox(customerTemplateCard, "mobile template workspace"),
      requireBox(orderPreviewPanel, "mobile email preview"),
    ]);
    expect(previewBox.x).toBeGreaterThanOrEqual(customerCardBox.x - 1);
    expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(
      customerCardBox.x + customerCardBox.width + 1,
    );
    const mobileZoomReset = page.getByTestId("order-email-preview-zoom-reset");
    const mobilePreviewViewport = page.getByTestId("order-email-preview-viewport");
    await expect(mobileZoomReset).toHaveText("100 %");
    const mobilePreviewHeight = await mobilePreviewViewport.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    expect(mobilePreviewHeight).toBeGreaterThanOrEqual(590);
    expect(mobilePreviewHeight).toBeLessThanOrEqual(594);
    await page.getByTestId("order-email-preview-zoom-in").click();
    await expect(mobileZoomReset).toHaveText("110 %");
    const zoomedMobileViewportMetrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ),
    }));
    expect(zoomedMobileViewportMetrics.documentWidth).toBeLessThanOrEqual(
      zoomedMobileViewportMetrics.viewportWidth + 1,
    );
    await mobileZoomReset.click();
    await expect(mobileZoomReset).toHaveText("100 %");
    await orderTemplateSection
      .getByRole("tab", { name: "Šola / javni zavod", exact: true })
      .click();
    await expect(
      page.getByTestId("order-email-template-school-customer"),
    ).toBeVisible();
    await expect(customerTemplateCard).toHaveCount(0);
    await orderTemplateSection
      .getByRole("tab", { name: "Admin", exact: true })
      .click();
    await expect(page.getByTestId("order-email-template-admin")).toBeVisible();
    await expect(
      page.getByTestId("order-email-template-school-customer"),
    ).toHaveCount(0);
  } finally {
    const [restoreResponse, restoreQuoteResponse] = await Promise.all([
      page.request.put("/api/admin/order-email-settings", {
        data: { config: originalConfig },
      }),
      page.request.put("/api/admin/quote-email-settings", {
        data: { config: originalQuoteConfig },
      }),
    ]);
    expect(restoreResponse.ok()).toBeTruthy();
    expect(restoreQuoteResponse.ok()).toBeTruthy();
  }
});
