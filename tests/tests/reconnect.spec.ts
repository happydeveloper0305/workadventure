import { expect, test } from '@playwright/test';
import {findContainer, rebootPlay, stopContainer} from './utils/containers';
import { login } from './utils/roles';
import {publicTestMapUrl} from "./utils/urls";

test.setTimeout(180_000);
test.describe('Connection', () => {
  test('can succeed even if WorkAdventure starts while pusher is down @docker', async ({ page }, { project }) => {
    // Skip test for mobile device
    if(project.name === "mobilechromium") {
      //eslint-disable-next-line playwright/no-skipped-test
      test.skip();
      return;
    }

    await page.goto(
      publicTestMapUrl("tests/mousewheel.json", "reconnect")
    );

    await login(page);

    // Let's stop the play container
    const container = await findContainer('play');
    await stopContainer(container);

    await expect(page.locator('.errorScreen p.code')).toContainText('CONNECTION_');
    //await expect(page.locator('.error-div')).toContainText('Unable to connect to WorkAdventure');

    //await page.goto('/_/global/maps.workadventure.localhost/tests/mousewheel.json');
    //await expect(page.locator('.error-div')).toContainText('Unable to connect to WorkAdventure');
    //await expect(page.locator('.errorScreen p.code')).toContainText('HTTP_ERROR');

    await rebootPlay();

    //await page.goto('/_/global/maps.workadventure.localhost/tests/mousewheel.json');
    await expect(page.locator("button#menuIcon")).toBeVisible({
      timeout: 180_000
    });
  });
});
