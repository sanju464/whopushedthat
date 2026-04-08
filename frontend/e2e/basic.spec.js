import { test, expect } from '@playwright/test';

test('basic gameplay flow: create room', async ({ page }) => {
  // Go to local frontend
  await page.goto('/');

  // Expect title to reflect the game
  await expect(page).toHaveTitle(/whopushedthat/i);

  // Fill in the username
  const usernameInput = page.locator('#username-input');
  await usernameInput.waitFor({ state: 'visible' });
  await usernameInput.fill('TestUser123');

  // Click on "Create Room"
  const createRoomBtn = page.locator('#create-room-btn');
  await createRoomBtn.click();

  // Confirm creation
  const confirmCreateBtn = page.locator('#confirm-create-btn');
  await confirmCreateBtn.waitFor({ state: 'visible' });
  await confirmCreateBtn.click();

  // Verify transition to waiting room by checking for ROOM CODE visibility
  await expect(page.getByText('ROOM CODE')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#copy-code-btn')).toBeVisible({ timeout: 10000 });
  
  // The room code text value itself should be populated (a 5 char code)
  // We just verify it successfully reached the waiting room!
});
