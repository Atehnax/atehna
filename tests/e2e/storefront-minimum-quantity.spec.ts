import { expect, test, type Locator, type Page } from '@playwright/test';

const productPath = '/products/materiali/items/aluminijasta-plosca';

async function openProductWithEmptyCart(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem('atehna-cart-v3');
  });
  await page.goto(productPath);
}

async function typeOneThenFive(input: Locator) {
  await input.selectText();
  await input.press('1');
  await expect(input).toHaveValue('1');
  await input.press('5');
  await expect(input).toHaveValue('15');
}

test('accepts a multi-digit product and cart quantity before validating on commit', async ({
  page
}) => {
  await openProductWithEmptyCart(page);

  const purchasePanel = page.getByRole('complementary', {
    name: 'Nakup izdelka',
    exact: true
  });
  const dimensionalSelector = page.locator(
    '.storefront-dimensional-variant-selector'
  );
  await dimensionalSelector.getByRole('button', { name: '1 mm', exact: true }).click();

  await expect(purchasePanel).toContainText('Minimalno naročilo: 5');
  const productQuantity = purchasePanel.getByLabel('Količina', {
    exact: true
  });
  await expect(productQuantity).toHaveValue('5');

  await typeOneThenFive(productQuantity);
  await productQuantity.selectText();
  await productQuantity.press('4');
  await expect(productQuantity).toHaveValue('4');
  await expect(purchasePanel.getByRole('alert')).toHaveCount(0);

  await purchasePanel
    .getByRole('button', { name: 'Dodaj v košarico', exact: true })
    .click();
  await expect(purchasePanel.getByRole('alert')).toHaveText(
    'Najmanjša količina je 5.'
  );
  await expect(productQuantity).toHaveValue('4');
  await expect(page.getByRole('dialog', { name: /^Košarica/u })).toHaveCount(0);

  await typeOneThenFive(productQuantity);
  await expect(purchasePanel.getByRole('alert')).toHaveCount(0);
  await purchasePanel
    .getByRole('button', { name: 'Dodaj v košarico', exact: true })
    .click();

  const drawer = page.getByRole('dialog', { name: /^Košarica/u });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId('cart-drawer-shipping')).toContainText(
    'Izračun na strani za naročilo'
  );
  const cartQuantity = drawer.getByLabel('Količina za Aluminijasta plošča', {
    exact: true
  });
  await expect(cartQuantity).toHaveValue('15');

  await typeOneThenFive(cartQuantity);
  await cartQuantity.selectText();
  await cartQuantity.press('4');
  await expect(cartQuantity).toHaveValue('4');
  await expect(drawer).toHaveAccessibleName('Košarica (15)');
  await expect(drawer.getByRole('alert')).toHaveCount(0);
  const checkoutLink = drawer.getByRole('link', {
    name: 'Nadaljuj na naročilo',
    exact: true
  });
  await expect(checkoutLink).toHaveAttribute('aria-disabled', 'true');
  await cartQuantity.press('Enter');
  await expect(drawer.getByRole('alert')).toHaveText(
    'Najmanjša količina je 5.'
  );
  await expect(cartQuantity).toHaveValue('4');
  await expect(drawer).toHaveAccessibleName('Košarica (15)');
  await expect(checkoutLink).toHaveAttribute('aria-disabled', 'true');
  await checkoutLink.focus();
  await checkoutLink.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${productPath}$`, 'u'));
  await expect(drawer).toBeVisible();

  await cartQuantity.selectText();
  await cartQuantity.press('2');
  await expect(cartQuantity).toHaveValue('2');
  await cartQuantity.press('5');
  await expect(cartQuantity).toHaveValue('25');
  await expect(drawer.getByRole('alert')).toHaveCount(0);
  await expect(checkoutLink).toHaveAttribute('aria-disabled', 'false');
  await checkoutLink.click();
  await expect(page).toHaveURL(/\/order$/u);
});

test('validates a related-product quantity only when quick add is submitted', async ({
  page
}) => {
  await openProductWithEmptyCart(page);

  const relatedCard = page
    .locator('.storefront-related-product-card')
    .filter({
      has: page.getByRole('heading', {
        name: 'Jeklena merilna letvica',
        exact: true
      })
    });
  await expect(relatedCard).toBeVisible();
  const relatedQuantity = relatedCard.getByLabel('Količina', { exact: true });
  await expect(relatedQuantity).toHaveValue('5');

  await typeOneThenFive(relatedQuantity);
  await relatedQuantity.selectText();
  await relatedQuantity.press('4');
  await expect(relatedQuantity).toHaveValue('4');
  await expect(relatedCard.getByRole('alert')).toHaveCount(0);

  await relatedCard
    .getByRole('button', { name: 'Dodaj v košarico', exact: true })
    .click();
  await expect(relatedCard.getByRole('alert')).toHaveText(
    'Najmanjša količina je 5.'
  );
  await expect(relatedQuantity).toHaveValue('4');
  await expect(page.getByRole('dialog', { name: /^Košarica/u })).toHaveCount(0);

  await typeOneThenFive(relatedQuantity);
  await expect(relatedCard.getByRole('alert')).toHaveCount(0);
  await relatedCard
    .getByRole('button', { name: 'Dodaj v košarico', exact: true })
    .click();

  const drawer = page.getByRole('dialog', { name: /^Košarica/u });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByLabel('Količina za Jeklena merilna letvica', { exact: true })
  ).toHaveValue('15');
});
