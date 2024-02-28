import { expect, test } from '@playwright/test';
import { login } from './utils/roles';
import {oidcLogin, oidcLogout} from "./utils/oidc";
import {evaluateScript} from "./utils/scripting";
import {publicTestMapUrl} from "./utils/urls";

test.describe('OpenID connect @oidc', () => {
  test('can login and logout', async ({
    page,
  }, { project }) => {
    // Skip test for mobile device
    if(project.name === "mobilechromium") {
      //eslint-disable-next-line playwright/no-skipped-test
      test.skip();
      return;
    }

    await page.goto(
        publicTestMapUrl("tests/E2E/empty.json", "oidc")
    );

    await login(page);

    // Test if player variable is correct
    let isLogged = await evaluateScript(page, async () => {
      await WA.onInit();
      return WA.player.isLogged;
    });
    await expect(isLogged).toBe(false);

    // Sign in, then sign out
    await oidcLogin(page);

    // Test if player variable is correct
    isLogged = await evaluateScript(page, async () => {
      await WA.onInit();
      return WA.player.isLogged;
    });
    await expect(isLogged).toBe(true);

    // Log out user
    await oidcLogout(page);

    // Let's check the sign in button is back here when we signed out
    await page.click('#menuIcon img:first-child');
    await expect(page.locator('a:has-text("Sign in")')).toContainText("Sign in");

    // Let's try to login using the scripting API
    await evaluateScript(page, async () => {
      await WA.onInit();
      await WA.nav.goToLogin();
    });
    await expect(page.locator('#Input_Username')).toBeVisible();
  });
});
