import { expect, test } from '@playwright/test';

test('footer sections are independently editable and save the horizontal contact fallback', async ({ page }) => {
  await page.goto('/admin/podoba/navigacija');

  const editor = page.getByTestId('site-footer-links-editor');
  const preview = editor.getByTestId('site-footer-editor-preview');
  const upperToggle = editor.getByRole('checkbox', { name: 'Prikaži zgornji del' });
  const lowerToggle = editor.getByRole('checkbox', { name: 'Prikaži spodnji del' });

  await expect(editor.getByRole('group', { name: 'Vidnost delov noge' })).toBeVisible();
  await expect(upperToggle).toBeChecked();
  await expect(lowerToggle).toBeChecked();
  await expect(preview.getByTestId('site-footer-upper-section')).toBeVisible();
  await expect(preview.getByTestId('site-footer-lower-section')).toBeVisible();
  await expect(editor.getByRole('checkbox', { name: 'Prikaži kontakt v spodnjem delu' })).toHaveCount(0);

  await upperToggle.uncheck();

  const lowerContactToggle = editor.getByRole('checkbox', {
    name: 'Prikaži kontakt v spodnjem delu'
  });
  await expect(lowerContactToggle).toBeVisible();
  await expect(lowerContactToggle).toBeChecked();
  const lowerContact = preview.getByTestId('site-footer-lower-contact');
  await expect(lowerContact).toBeVisible();
  await expect(lowerContact).toHaveAttribute('data-footer-contact-layout', 'horizontal');

  const phoneButton = lowerContact.getByRole('button', { name: '+386 1 234 56 78', exact: true });
  await phoneButton.click();
  const phoneInput = lowerContact.getByRole('textbox', { name: 'Telefon', exact: true });
  const nextPhone = '+386 1 555 44 33';
  await phoneInput.fill(nextPhone);
  await phoneInput.press('Enter');
  await expect(lowerContact.getByRole('button', { name: nextPhone, exact: true })).toBeVisible();

  await lowerToggle.uncheck();
  await expect(lowerToggle).not.toBeChecked();
  await upperToggle.check();
  await expect(upperToggle).toBeChecked();
  await lowerToggle.check();
  await upperToggle.uncheck();
  await lowerContactToggle.uncheck();
  await expect(lowerContactToggle).not.toBeChecked();

  let savedPayload: {
    config: {
      footer: {
        upperSectionVisible: boolean;
        lowerSectionVisible: boolean;
        lowerContactVisible: boolean;
        contact: { phone: string };
      };
    };
  } | null = null;
  await page.route('**/api/admin/site-navigation', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    savedPayload = route.request().postDataJSON() as typeof savedPayload;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ config: savedPayload?.config })
    });
  });

  await page.getByRole('button', { name: 'Shrani', exact: true }).click();

  await expect.poll(() => savedPayload).not.toBeNull();
  expect(savedPayload).not.toBeNull();
  expect(savedPayload!.config.footer).toMatchObject({
    upperSectionVisible: false,
    lowerSectionVisible: true,
    lowerContactVisible: false,
    contact: { phone: nextPhone }
  });

  const editLogoLink = editor.getByRole('link', { name: 'Uredi logotip' });
  await expect(editLogoLink).toHaveAttribute('href', '/admin/podoba/logotip');
});
