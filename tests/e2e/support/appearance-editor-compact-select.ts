import {
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

type CompactSelectScope = Page | Locator;

const triggerMarker = '[data-appearance-editor-compact-select-trigger]';
const valueMarker = 'data-appearance-editor-compact-select-value';
const optionMarker = 'data-appearance-editor-compact-select-option';

export function getAppearanceEditorCompactSelect(
  scope: CompactSelectScope,
  accessibleName: string,
): Locator {
  return scope
    .getByRole('button', { name: accessibleName, exact: true })
    .and(scope.locator(triggerMarker));
}

export async function readAppearanceEditorCompactSelectValue(
  trigger: Locator,
): Promise<string> {
  return await trigger.getAttribute(valueMarker) ?? '';
}

async function openAppearanceEditorCompactSelect(
  page: Page,
  trigger: Locator,
): Promise<Locator> {
  const accessibleName = await trigger.getAttribute('aria-label');
  if (!accessibleName) {
    throw new Error('Appearance editor compact select trigger needs an accessible name.');
  }

  if (await trigger.getAttribute('aria-expanded') !== 'true') {
    await trigger.click();
  }
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const listbox = page.getByRole('listbox', {
    name: accessibleName,
    exact: true,
  });
  await expect(listbox).toBeVisible();
  return listbox;
}

export async function chooseAppearanceEditorCompactSelectOption(
  page: Page,
  trigger: Locator,
  value: string,
): Promise<void> {
  if (await readAppearanceEditorCompactSelectValue(trigger) === value) return;

  const listbox = await openAppearanceEditorCompactSelect(page, trigger);
  const option = listbox.locator(
    `[${optionMarker}=${JSON.stringify(value)}]`,
  );
  await expect(option, `compact select should expose option value "${value}"`)
    .toHaveCount(1);
  await option.click();

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveAttribute(valueMarker, value);
}

export async function readAppearanceEditorCompactSelectOptions(
  page: Page,
  trigger: Locator,
): Promise<string[]> {
  const wasOpen = await trigger.getAttribute('aria-expanded') === 'true';
  const listbox = await openAppearanceEditorCompactSelect(page, trigger);

  try {
    return await listbox.locator(`[${optionMarker}]`).evaluateAll(
      (options, attribute) => options
        .map((option) => option.getAttribute(attribute))
        .filter((value): value is string => value !== null),
      optionMarker,
    );
  } finally {
    if (!wasOpen && await trigger.getAttribute('aria-expanded') === 'true') {
      await page.keyboard.press('Escape');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
  }
}
