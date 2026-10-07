import { webkit } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { CONTENT_VERSION } from "../src/data/materials";
const browser = await webkit.launch();
const base = pathToFileURL(resolve("dist/index.html")).href;
for (const offline of [true, false]) {
  const context = await browser.newContext({ offline });
  for (const suffix of [
    "",
    `?seed=registration&v=${CONTENT_VERSION}`,
    `#seed=registration&v=${CONTENT_VERSION}`,
  ]) {
    const page = await context.newPage();
    try {
      await page.goto(base + suffix, {
        timeout: 8000,
        waitUntil: "domcontentloaded",
      });
      console.log(
        JSON.stringify({
          offline,
          suffix,
          url: page.url(),
          body: (await page.locator("body").innerText()).slice(0, 160),
        }),
      );
    } catch (e) {
      console.log(
        JSON.stringify({ offline, suffix, error: String(e).split("\n")[0] }),
      );
    }
    await page.close();
  }
  await context.close();
}
await browser.close();
