import { expect, test } from '@playwright/test';

test.describe('admin podoba redesign', () => {
  test('footer legal row uses a top divider without a surrounding outline', async ({ page }) => {
    await page.goto('/admin/podoba/navigacija');

    const footerPreview = page.getByTestId('site-footer-editor-preview');
    const copyrightButton = footerPreview.getByRole('button', { name: /^© \d{4} Atehna d\.o\.o\./ });
    await expect(copyrightButton).toBeVisible({ timeout: 15_000 });

    const borderWidths = await copyrightButton.evaluate((node) => {
      const row = node.closest('.site-divider');
      if (!(row instanceof HTMLElement)) throw new Error('Spodnja vrstica noge manjka.');
      const style = getComputedStyle(row);
      return {
        top: style.borderTopWidth,
        right: style.borderRightWidth,
        bottom: style.borderBottomWidth,
        left: style.borderLeftWidth
      };
    });

    expect(Number.parseFloat(borderWidths.top)).toBeGreaterThan(0);
    expect(borderWidths.right).toBe('0px');
    expect(borderWidths.bottom).toBe('0px');
    expect(borderWidths.left).toBe('0px');
  });

  test('navigation editor provides a visual footer editor and saves nested content', async ({ page }) => {
    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as { config: unknown };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ config: requestBody.config })
      });
    });
    await page.goto('/admin/podoba/navigacija', { waitUntil: 'networkidle' });

    const footerEditor = page.getByTestId('site-footer-links-editor');
    const footerPreview = footerEditor.getByTestId('site-footer-editor-preview');
    await expect(footerEditor).toBeVisible({ timeout: 15_000 });
    await expect(footerEditor.getByRole('heading', { level: 2, name: 'Noga spletnega mesta' })).toBeVisible();
    await expect(footerPreview).toBeVisible();
    await expect(footerEditor.getByText(/^Kliknite besedilo za neposredno urejanje\./)).toHaveCount(0);

    const previewRadiusContract = await footerPreview.evaluate((frame) => {
      const surface = frame.querySelector<HTMLElement>('[data-admin-editor-preview-surface="true"]');
      const footer = surface?.querySelector<HTMLElement>(':scope > footer');
      const content = footer?.querySelector<HTMLElement>(':scope > .site-container');
      if (!surface || !footer || !content) throw new Error('Footer preview radius layers are missing.');

      const snapshot = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          overflow: style.overflow,
          radii: [
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomRightRadius,
            style.borderBottomLeftRadius
          ]
        };
      };

      return {
        frame: snapshot(frame as HTMLElement),
        surface: snapshot(surface),
        footer: snapshot(footer),
        content: snapshot(content)
      };
    });
    const frameRadii = previewRadiusContract.frame.radii;
    expect(previewRadiusContract.frame.overflow).toBe('visible');
    expect(new Set(frameRadii).size).toBe(1);
    expect(parseFloat(frameRadii[0] ?? '0')).toBeGreaterThan(0);
    for (const layer of [
      previewRadiusContract.surface,
      previewRadiusContract.footer,
      previewRadiusContract.content
    ]) {
      expect(layer.radii).toEqual(frameRadii);
    }

    const footerColumns = footerPreview.getByRole('navigation', { name: 'Povezave v nogi' });
    const footerColumnMoveButtons = footerColumns.getByRole('button', { name: /^Premakni stolpec / });
    const footerColumnOptionButtons = footerColumns.getByRole('button', { name: /^Možnosti stolpca / });
    const footerLinkMoveButtons = footerColumns.getByRole('button', { name: /^Premakni (?!stolpec )/ });
    const footerLinkOptionButtons = footerColumns.getByRole('button', { name: /^Možnosti povezave v nogi / });
    await expect(footerColumnMoveButtons).toHaveCount(0);
    await expect(footerColumnOptionButtons).toHaveCount(3);
    await expect(footerLinkMoveButtons).toHaveCount(9);
    await expect(footerLinkOptionButtons).toHaveCount(9);
    for (const columnTitle of ['Izdelki', 'Podpora', 'O nas']) {
      await expect(footerColumns.getByRole('button', { name: columnTitle, exact: true })).toBeVisible();
    }

    const columnTitleButtons = footerColumns.getByRole('button', { name: /^(Izdelki|Podpora|O nas)$/ });
    const addFooterColumnButton = footerPreview.getByRole('button', { name: 'Dodaj stolpec v nogo' });
    await expect(columnTitleButtons).toHaveCount(3);
    await expect(addFooterColumnButton).toBeVisible();
    const [columnTitleBoxes, columnMenuBoxes, columnsNavBox, addFooterColumnBox] = await Promise.all([
      columnTitleButtons.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      footerColumnOptionButtons.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      footerColumns.boundingBox(),
      addFooterColumnButton.boundingBox()
    ]);
    expect(columnsNavBox).not.toBeNull();
    expect(addFooterColumnBox).not.toBeNull();
    if (!columnsNavBox || !addFooterColumnBox) throw new Error('Kontrole stolpcev noge nimajo merljive geometrije.');
    const addFooterColumnCenterY = addFooterColumnBox.y + addFooterColumnBox.height / 2;
    columnTitleBoxes.forEach((titleBox, index) => {
      const menuBox = columnMenuBoxes[index];
      if (!menuBox) throw new Error('Stolpec noge nima menijske kontrole.');
      const titleCenterY = titleBox.y + titleBox.height / 2;
      const menuCenterY = menuBox.y + menuBox.height / 2;
      expect(Math.abs(menuCenterY - titleCenterY)).toBeLessThanOrEqual(4);
      expect(Math.abs(addFooterColumnCenterY - titleCenterY)).toBeLessThanOrEqual(4);
    });
    expect(addFooterColumnBox.x).toBeGreaterThanOrEqual(columnsNavBox.x + columnsNavBox.width - 1);

    for (const columnTitle of ['Izdelki', 'Podpora', 'O nas']) {
      const columnEditor = footerColumns
        .getByRole('button', { name: columnTitle, exact: true })
        .locator(
          'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " group/footer-column ")][1]'
        );
      const headingMenu = columnEditor.getByRole('button', { name: `Možnosti stolpca ${columnTitle}` });
      const linkMenus = columnEditor.getByRole('button', { name: /^Možnosti povezave v nogi / });
      const [headingMenuBox, linkMenuBoxes] = await Promise.all([
        headingMenu.boundingBox(),
        linkMenus.evaluateAll((nodes) => nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { x: box.x, width: box.width };
        }))
      ]);

      expect(headingMenuBox).not.toBeNull();
      if (!headingMenuBox) throw new Error(`Meni stolpca ${columnTitle} nima merljive geometrije.`);
      const headingMenuCenterX = headingMenuBox.x + headingMenuBox.width / 2;
      linkMenuBoxes.forEach((linkMenuBox) => {
        const linkMenuCenterX = linkMenuBox.x + linkMenuBox.width / 2;
        expect(Math.abs(linkMenuCenterX - headingMenuCenterX)).toBeLessThanOrEqual(1);
      });
    }

    const expectPersistentFooterOptions = async (buttons: typeof footerColumnOptionButtons) => {
      const visibleStates = await buttons.evaluateAll((nodes) => nodes.map((node) => {
        let current: Element | null = node;
        while (current) {
          const style = getComputedStyle(current);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          if (current.getAttribute('data-testid') === 'site-footer-editor-preview') break;
          current = current.parentElement;
        }
        return true;
      }));
      expect(visibleStates.every(Boolean)).toBe(true);
    };
    await page.mouse.move(0, 0);
    await expectPersistentFooterOptions(footerColumnOptionButtons);
    await expectPersistentFooterOptions(footerLinkOptionButtons);

    const catalogMoveButton = footerColumns.getByRole('button', { name: 'Premakni Katalog' });
    const projectsMoveButton = footerColumns.getByRole('button', { name: 'Premakni Projekti' });
    await catalogMoveButton.scrollIntoViewIfNeeded();
    const [catalogMoveBox, catalogRowBox, projectsMoveBox] = await Promise.all([
      catalogMoveButton.boundingBox(),
      catalogMoveButton.locator('..').boundingBox(),
      projectsMoveButton.boundingBox()
    ]);
    expect(catalogMoveBox).not.toBeNull();
    expect(catalogRowBox).not.toBeNull();
    expect(projectsMoveBox).not.toBeNull();
    if (!catalogMoveBox || !catalogRowBox || !projectsMoveBox) throw new Error('Povezav v nogi ni mogoče premakniti.');
    expect(Math.abs(catalogMoveBox.x - catalogRowBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(catalogMoveBox.y - catalogRowBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(catalogMoveBox.width - catalogRowBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(catalogMoveBox.height - catalogRowBox.height)).toBeLessThanOrEqual(2);
    await expect(catalogMoveButton).toHaveAttribute('aria-roledescription', 'sortable');
    await expect(catalogMoveButton).toHaveAttribute('aria-describedby', /site-footer-column-links-/);

    await catalogMoveButton.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(footerColumns.getByRole('button', { name: /^(Katalog|Za šole|Projekti)$/ })).toHaveText([
      'Za šole',
      'Projekti',
      'Katalog'
    ]);
    await expect(footerColumns.getByRole('heading', { level: 2 })).toHaveText(['Izdelki', 'Podpora', 'O nas']);

    const catalogFooterLink = footerColumns.getByRole('button', { name: 'Katalog', exact: true });
    await catalogFooterLink.hover();
    await expect(catalogFooterLink).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(catalogFooterLink.locator('..')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    await expect(footerPreview.getByRole('button', { name: 'info@atehna.si', exact: true })).toBeVisible();
    const phoneValue = '+386 1 234 56 78';
    const phoneEditor = footerPreview.getByRole('button', { name: phoneValue, exact: true });
    await expect(phoneEditor).toBeVisible();
    await expect(footerPreview.getByRole('link', { name: phoneValue, exact: true })).toHaveCount(0);
    await expect(footerPreview.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(phoneEditor).not.toHaveClass(/(?:^|\s)site-link(?:\s|$)/);
    await phoneEditor.click();
    const phoneInput = footerPreview.getByRole('textbox', { name: 'Telefon', exact: true });
    await expect(phoneInput).toHaveValue(phoneValue);
    await phoneInput.fill('+386 1 234 56 79');
    await phoneInput.press('Escape');
    await expect(phoneEditor).toBeVisible();
    await expect(phoneEditor).toHaveText(phoneValue);
    await expect(footerPreview.getByRole('button', { name: 'Ulica in kraj', exact: true })).toBeVisible();
    await expect(footerPreview.getByRole('button', { name: 'Pon-Pet 8:00-16:00', exact: true })).toBeVisible();
    await expect(footerPreview.getByRole('heading', { level: 2, name: 'Spremljajte nas' })).toBeVisible();
    const socialRegion = footerPreview.getByRole('region', { name: 'Spremljajte nas' });
    const socialMoveButtons = socialRegion.getByRole('button', { name: /^Premakni družbeno omrežje / });
    const socialOptionButtons = socialRegion.getByRole('button', { name: /^Možnosti družbenega omrežja / });
    const addSocialButton = socialRegion.getByRole('button', { name: 'Dodaj družbeni profil' });
    await expect(socialMoveButtons).toHaveCount(4);
    await expect(socialOptionButtons).toHaveCount(4);
    await expectPersistentFooterOptions(socialOptionButtons);
    await page.evaluate(async () => { await document.fonts.ready; });

    const socialBrandIcons = socialRegion.locator('svg[data-social-brand-icon="true"][data-social-type]');
    await expect(socialBrandIcons).toHaveCount(4);
    expect(await socialBrandIcons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-social-type'))))
      .toEqual(['facebook', 'instagram', 'youtube', 'linkedin']);
    await expect(socialRegion.locator('svg.lucide-globe-2')).toHaveCount(0);
    const socialBrandGeometry = await socialBrandIcons.evaluateAll((nodes) => nodes.map((node) => (
      node.innerHTML.replace(/\s+/g, ' ').trim()
    )));
    expect(socialBrandGeometry.every((geometry) => geometry.length > 0)).toBe(true);
    expect(new Set(socialBrandGeometry).size).toBe(4);

    const socialIconSurfaces = socialBrandIcons.locator('xpath=parent::*');
    const [socialMoveBoxes, socialIconSurfaceBoxes, socialMenuBoxes, lastSocialRowBox, addSocialBox] = await Promise.all([
      socialMoveButtons.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      socialIconSurfaces.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      socialOptionButtons.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      socialMoveButtons.last().locator('..').boundingBox(),
      addSocialButton.boundingBox()
    ]);
    expect(lastSocialRowBox).not.toBeNull();
    expect(addSocialBox).not.toBeNull();
    if (!lastSocialRowBox || !addSocialBox) throw new Error('Kontrole družbenih omrežij nimajo merljive geometrije.');
    expect(socialMoveBoxes).toHaveLength(4);
    expect(socialIconSurfaceBoxes).toHaveLength(4);
    expect(socialMenuBoxes).toHaveLength(4);
    socialMoveBoxes.forEach((moveBox, index) => {
      const iconBox = socialIconSurfaceBoxes[index];
      const menuBox = socialMenuBoxes[index];
      if (!iconBox || !menuBox) throw new Error('Družbeni profil nima vseh kontrol.');
      const iconCenterY = iconBox.y + iconBox.height / 2;
      const menuCenterY = menuBox.y + menuBox.height / 2;
      const menuGap = menuBox.x - (iconBox.x + iconBox.width);
      expect(Math.abs(menuCenterY - iconCenterY)).toBeLessThanOrEqual(1);
      expect(menuGap).toBeGreaterThanOrEqual(0);
      expect(menuGap).toBeLessThanOrEqual(8);
      expect(moveBox.x).toBeLessThanOrEqual(iconBox.x);
      expect(moveBox.y).toBeLessThanOrEqual(iconBox.y);
      expect(moveBox.x + moveBox.width).toBeGreaterThanOrEqual(menuBox.x + menuBox.width);
      expect(moveBox.y + moveBox.height).toBeGreaterThanOrEqual(menuBox.y + menuBox.height);
    });
    const lastSocialBox = socialMoveBoxes.at(-1)!;
    expect(Math.abs(lastSocialBox.x - lastSocialRowBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(lastSocialBox.y - lastSocialRowBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(lastSocialBox.width - lastSocialRowBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(lastSocialBox.height - lastSocialRowBox.height)).toBeLessThanOrEqual(2);
    expect(addSocialBox.x).toBeGreaterThan(lastSocialBox.x + lastSocialBox.width);
    expect(Math.abs(
      (addSocialBox.y + addSocialBox.height / 2) - (lastSocialBox.y + lastSocialBox.height / 2)
    )).toBeLessThanOrEqual(1);

    await socialOptionButtons.first().click();
    await socialRegion.getByRole('button', { name: 'Skrij', exact: true }).click();
    await expect(socialRegion.getByText('Skrito', { exact: true })).toHaveCount(1);
    await socialOptionButtons.first().click();
    await socialRegion.getByRole('button', { name: 'Prikaži', exact: true }).click();
    await expect(socialRegion.getByText('Skrito', { exact: true })).toHaveCount(0);

    await addSocialButton.click();
    await expect(socialMoveButtons).toHaveCount(5);
    await socialRegion.getByRole('button', { name: 'Možnosti družbenega omrežja Nov profil' }).click();
    await socialRegion.getByRole('button', { name: 'Izbriši', exact: true }).click();
    await expect(socialMoveButtons).toHaveCount(4);
    await expect(footerPreview.getByRole('button', { name: 'Dodaj pravno povezavo' })).toBeVisible();
    await expect(footerPreview.getByRole('button', { name: /^© \d{4} Atehna d\.o\.o\./ })).toBeVisible();
    const legalEditor = footerPreview.getByLabel('Urejanje pravnih povezav');
    const legalMoveButtons = legalEditor.getByRole('button', { name: /^Premakni / });
    const legalOptionButtons = legalEditor.getByRole('button', { name: /^Možnosti povezave v nogi / });
    await expect(legalMoveButtons).toHaveCount(3);
    await expect(legalOptionButtons).toHaveCount(3);
    await expectPersistentFooterOptions(legalOptionButtons);
    await expect(footerPreview.getByRole('button', { name: /^Ikona za/ })).toHaveCount(0);

    const copyrightButton = footerPreview.getByRole('button', { name: /^© \d{4} Atehna d\.o\.o\./ });
    const termsButton = legalEditor.getByRole('button', { name: 'Pogoji uporabe', exact: true });
    const privacyButton = legalEditor.getByRole('button', { name: 'Zasebnost', exact: true });
    const cookiesButton = legalEditor.getByRole('button', { name: 'Piškotki', exact: true });
    const addLegalButton = footerPreview.getByRole('button', { name: 'Dodaj pravno povezavo' });
    const legalBoxes = await Promise.all([
      copyrightButton.boundingBox(),
      termsButton.boundingBox(),
      privacyButton.boundingBox(),
      cookiesButton.boundingBox(),
      legalOptionButtons.last().boundingBox(),
      addLegalButton.boundingBox()
    ]);
    const [copyrightBox, termsBox, privacyBox, cookiesBox, lastLegalOptionsBox, addLegalBox] = legalBoxes.map((box) => {
      expect(box).not.toBeNull();
      if (!box) throw new Error('Element spodnje vrstice noge nima merljive geometrije.');
      return box;
    });
    const legalCenters = [copyrightBox, termsBox, privacyBox, cookiesBox, lastLegalOptionsBox, addLegalBox]
      .map((box) => box.y + box.height / 2);
    legalCenters.slice(1).forEach((center) => {
      expect(Math.abs(center - legalCenters[0])).toBeLessThanOrEqual(1);
    });
    const legalRowCenterY = await copyrightButton.evaluate((node) => {
      const row = node.closest('.site-divider');
      if (!(row instanceof HTMLElement)) throw new Error('Spodnja vrstica noge manjka.');
      const box = row.getBoundingClientRect();
      const style = getComputedStyle(row);
      const usableTop = box.top + (Number.parseFloat(style.borderTopWidth) || 0);
      const usableBottom = box.bottom - (Number.parseFloat(style.borderBottomWidth) || 0);
      return (usableTop + usableBottom) / 2;
    });
    const legalRowBorders = await copyrightButton.evaluate((node) => {
      const row = node.closest('.site-divider');
      if (!(row instanceof HTMLElement)) throw new Error('Spodnja vrstica noge manjka.');
      const style = getComputedStyle(row);
      return {
        top: style.borderTopWidth,
        right: style.borderRightWidth,
        bottom: style.borderBottomWidth,
        left: style.borderLeftWidth
      };
    });
    expect(Number.parseFloat(legalRowBorders.top)).toBeGreaterThan(0);
    expect(legalRowBorders.right).toBe('0px');
    expect(legalRowBorders.bottom).toBe('0px');
    expect(legalRowBorders.left).toBe('0px');
    legalCenters.forEach((center) => {
      expect(Math.abs(center - legalRowCenterY)).toBeLessThanOrEqual(1);
    });
    expect(addLegalBox.width).toBe(28);
    expect(addLegalBox.height).toBe(28);
    expect(termsBox.x).toBeGreaterThan(copyrightBox.x + copyrightBox.width);
    expect(privacyBox.x).toBeGreaterThan(termsBox.x + termsBox.width);
    expect(cookiesBox.x).toBeGreaterThan(privacyBox.x + privacyBox.width);
    const legalAddGap = addLegalBox.x - (lastLegalOptionsBox.x + lastLegalOptionsBox.width);
    expect(legalAddGap).toBeGreaterThanOrEqual(4);
    expect(legalAddGap).toBeLessThanOrEqual(12);

    const nextEmail = 'footer-test@atehna.si';
    await footerPreview.getByRole('button', { name: 'info@atehna.si', exact: true }).click();
    await footerPreview.getByRole('textbox', { name: 'E-pošta', exact: true }).fill(nextEmail);
    await footerColumns.getByRole('button', { name: /^Dodaj povezavo v / }).first().click();
    await expect(footerColumns.getByRole('button', { name: /^Možnosti povezave v nogi / })).toHaveCount(10);

    await footerColumns.getByRole('button', { name: 'Nova povezava', exact: true }).click();
    const newLinkLabel = 'Testna povezava v nogi';
    const linkLabelInput = footerColumns.getByRole('textbox', { name: 'Naziv povezave v nogi' });
    await linkLabelInput.fill(newLinkLabel);
    await linkLabelInput.press('Enter');

    const saveButton = page.getByRole('button', { name: 'Shrani', exact: true });
    await expect(saveButton).toBeEnabled();
    const saveRequestPromise = page.waitForRequest((request) => (
      request.method() === 'PUT' && request.url().includes('/api/admin/site-navigation')
    ));
    await saveButton.click();
    const saveRequest = await saveRequestPromise;
    const savedPayload = saveRequest.postDataJSON() as {
      config: {
        footer: {
          contact: { email: string };
          columns: Array<{ links: Array<{ label: string; position: number }> }>;
        };
      };
    };

    expect(savedPayload.config.footer.contact.email).toBe(nextEmail);
    const savedFirstColumnLinks = savedPayload.config.footer.columns[0]?.links ?? [];
    expect(savedFirstColumnLinks.map((link) => link.label)).toEqual([
      'Za šole',
      'Projekti',
      'Katalog',
      newLinkLabel
    ]);
    expect(savedFirstColumnLinks.map((link) => link.position)).toEqual([0, 1, 2, 3]);
    expect(savedPayload.config.footer.columns.flatMap((column) => column.links.map((link) => link.label))).toContain(newLinkLabel);
  });
});
