import { expect, test } from '@playwright/test';

test('footer sections are independently editable and save the horizontal contact fallback', async ({ page }) => {
  await page.goto('/admin/podoba/navigacija');

  const editor = page.getByTestId('site-footer-links-editor');
  const preview = editor.getByTestId('site-footer-editor-preview');
  const upperToggle = editor.getByRole('switch', { name: 'Prikaži zgornji del' });
  const lowerToggle = editor.getByRole('switch', { name: 'Prikaži spodnji del' });

  await expect(editor.getByRole('group', { name: 'Vidnost delov noge' })).toBeVisible();
  await expect(upperToggle).toBeChecked();
  await expect(lowerToggle).toBeChecked();
  await expect(preview.getByTestId('site-footer-upper-section')).toBeVisible();
  await expect(preview.getByTestId('site-footer-lower-section')).toBeVisible();
  await expect(editor.getByRole('switch', { name: 'Prikaži kontakt v spodnjem delu' })).toBeVisible();
  await expect(editor.getByRole('switch', { name: 'Prikaži kontakt v spodnjem delu' })).toBeDisabled();

  await upperToggle.click();

  const lowerContactToggle = editor.getByRole('switch', {
    name: 'Prikaži kontakt v spodnjem delu'
  });
  await expect(lowerContactToggle).toBeVisible();
  await expect(lowerContactToggle).toBeEnabled();
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

  await lowerToggle.click();
  await expect(lowerToggle).not.toBeChecked();
  await upperToggle.click();
  await expect(upperToggle).toBeChecked();
  await lowerToggle.click();
  await upperToggle.click();
  await lowerContactToggle.click();
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

  await editor.getByRole('button', { name: 'Shrani spremembe', exact: true }).click();

  await expect.poll(() => savedPayload).not.toBeNull();
  expect(savedPayload).not.toBeNull();
  expect(savedPayload!.config.footer).toMatchObject({
    upperSectionVisible: false,
    lowerSectionVisible: true,
    lowerContactVisible: false,
    contact: { phone: nextPhone }
  });

  const editLogoLink = editor.getByRole('link', { name: 'Uredi logotip' });
  await expect(editLogoLink).toHaveCount(0);
  await expect(editor.getByRole('spinbutton', { name: 'Višina logotipa v nogi' })).toBeVisible();
});
