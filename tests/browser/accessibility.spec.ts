import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
test("plain double-click entry, keyboard submit and reduced motion", async ({
  page,
  context,
}) => {
  await context.route(/^https?:\/\//, (r) => r.abort("internetdisconnected"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    process.env.GAME_URL ?? pathToFileURL(resolve("dist/index.html")).href,
  );
  await page.getByLabel("账户名", { exact: true }).fill("键盘");
  await expect(
    page.getByRole("button", { name: "继续", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("账户名", { exact: true }).press("Enter");
  const editor = page.getByLabel("密码", { exact: true });
  await expect(editor).toBeVisible();
  await expect(page.locator(".rule-row")).toHaveCount(0);
  await editor.pressSequentially("tiny");
  await editor.press("Enter");
  await expect(page.locator(".rule-row")).toHaveCount(1);
  expect(await editor.evaluate((el) => document.activeElement === el)).toBe(
    true,
  );
  expect(
    await page
      .locator(".password-field")
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  await page.getByRole("button", { name: "字符说明" }).focus();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const focus = await page
    .getByRole("button", { name: "字符说明" })
    .evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(parseFloat(focus)).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "字符说明", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "字符说明" })).toBeFocused();
});
