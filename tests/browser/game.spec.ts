import { test, expect, type Page } from "@playwright/test";
import { CONTENT_VERSION } from "../../src/data/materials";
import { SESSION_KEY } from "../../src/ui/session";
import { generateGame } from "../../src/engine/generator";
import { describe } from "../../src/copy/language";
import { pathToFileURL } from "node:url";
import { resolve, extname } from "node:path";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
const game = generateGame("registration");
const root =
  process.env.GAME_URL ?? pathToFileURL(resolve("dist/index.html")).href;
const rows = ".rule-row";
const captures = "reports/screenshots-copy";
test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\//, (route) =>
    new URL(route.request().url()).origin === new URL(root).origin
      ? route.continue()
      : route.abort("internetdisconnected"),
  );
});
function url(seed = "registration", version = CONTENT_VERSION) {
  const u = new URL(root);
  u.search = "";
  u.searchParams.set("seed", seed);
  u.searchParams.set("v", version);
  return u.href;
}
async function enter(page: Page) {
  await page.goto(url());
  await page.getByLabel("账户名", { exact: true }).fill("张鱼");
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(page.getByLabel("密码", { exact: true })).toBeVisible();
}
async function invite(page: Page, code: string) {
  await page.getByRole("button", { name: "输入邀请码", exact: true }).click();
  await page.getByLabel("邀请码", { exact: true }).fill(code);
  await page.getByRole("button", { name: "确认", exact: true }).click();
}
async function visibility(page: Page, value: "hidden" | "visible") {
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, value);
}
test("first Continue starts validation; native editing, restore, monotonic reveal and toast copies", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await enter(page);
  const editor = page.getByLabel("密码", { exact: true });
  await expect(page.locator("textarea")).toHaveCount(1);
  await expect(page.getByText("张鱼", { exact: true })).toHaveCount(0);
  await editor.fill("a".repeat(8193));
  await page.clock.runFor(5000);
  await expect(page.locator(rows)).toHaveCount(0);
  await expect(page.locator("#format-error")).toHaveCount(0);
  await expect(editor).toHaveAttribute("aria-invalid", "false");
  await editor.fill("A\n9!");
  await expect(editor).toHaveValue("A\n9!");
  await expect(page.locator("#format-error")).toHaveCount(0);
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(page.locator(rows)).toHaveCount(1);
  await expect(page.locator("#format-error")).toContainText("换行");
  await expect(page.locator(".rule-copy")).toHaveText(
    describe(game.plan.rules[0].predicate),
  );
  await editor.fill("Abcdefghijklmnopqrst9!");
  await page.clock.runFor(1601);
  await expect(page.locator(rows)).toHaveCount(2);
  await editor.evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(2, 4),
  );
  await editor.press("Z");
  await expect(editor).toHaveValue("AbZefghijklmnopqrst9!");
  await editor.press("Control+z");
  await expect(editor).toHaveValue("Abcdefghijklmnopqrst9!");
  await editor.press("Control+Shift+z");
  await expect(editor).toHaveValue("AbZefghijklmnopqrst9!");
  await editor.fill("");
  await page.clock.runFor(2000);
  await expect(page.locator(rows)).toHaveCount(2);
  await editor.fill(game.witness);
  await page.clock.runFor(1601);
  await expect(page.locator(rows)).toHaveCount(3);
  await page.reload();
  await expect(editor).toHaveValue(game.witness);
  await expect(page.locator(rows)).toHaveCount(3);
  for (let n = 4; n <= game.plan.rules.length; n++) {
    await page.clock.runFor(1601);
    await expect(page.locator(rows)).toHaveCount(n);
  }
  await page.clock.runFor(5000);
  await expect(
    page.getByRole("heading", { name: "设置密码", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.clock.runFor(1601);
  await expect(
    page.getByRole("heading", { name: "注册完成", exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveAttribute("readonly", "");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as any).copied = text;
        },
      },
    }),
  );
  await page.getByRole("button", { name: "复制邀请码", exact: true }).click();
  expect(await page.evaluate(() => (window as any).copied)).toBe(
    "registration",
  );
  await expect(page.locator(".toast")).toHaveText("邀请码已复制");
  await page.getByRole("button", { name: "复制密码", exact: true }).click();
  expect(await page.evaluate(() => (window as any).copied)).toBe(game.witness);
  await expect(page.locator(".toast")).toHaveText("密码已复制");
  await page.clock.runFor(4001);
  await expect(page.locator(".toast")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("production invite and EggYDX inspection work without storage, with clipboard fallback in dialog", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.goto(url());
  await invite(page, "EggYDX");
  await expect(page.locator("#invite-error")).toContainText("邀请码无效");
  await page.getByLabel("邀请码", { exact: true }).fill("bad seed");
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.locator("#invite-error")).toContainText("1～64");
  await page.getByLabel("邀请码", { exact: true }).fill("registration");
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveText("邀请码已使用");
  await expect(page.locator(".debug-panel")).toHaveCount(0);
  await invite(page, "EggYDX");
  await expect(
    page.getByRole("dialog", { name: "本局信息", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "可以完成", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`${game.plan.rules.length} 项`, { exact: true }),
  ).toBeVisible();
  await page.getByText("全部要求", { exact: true }).click();
  await expect(page.locator("dialog pre")).toHaveCount(0);
  expect(await page.locator("dialog").innerText()).not.toMatch(
    /Witness|构造|约束|反例|贡献|参数|诊断|内容版本/,
  );
  await page.getByText("参考密码", { exact: true }).click();
  await expect(page.locator(".debug-witness")).toHaveText(game.witness);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    });
    document.execCommand = (command: string) => {
      const selected = document.activeElement as HTMLTextAreaElement;
      (window as any).fallbackCopy = selected.value;
      return command === "copy";
    };
  });
  await page.getByRole("button", { name: "复制密码", exact: true }).click();
  expect(await page.evaluate(() => (window as any).fallbackCopy)).toBe(
    game.witness,
  );
  await expect(page.locator("dialog .toast")).toHaveText("密码已复制");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "输入邀请码", exact: true }),
  ).toBeFocused();
  await page.getByLabel("账户名", { exact: true }).fill("用户");
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByLabel("密码", { exact: true }).fill("tiny");
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(page.locator(".rule-copy")).toHaveText(
    describe(game.plan.rules[0].predicate),
  );
  expect(errors).toEqual([]);
});
test("default inspection stays closed; stall clock pauses, decline waits for progress, opt-in persists", async ({
  page,
}) => {
  await page.clock.install();
  await enter(page);
  const editor = page.getByLabel("密码", { exact: true });
  await editor.fill("tiny");
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.locator(".rule-content").hover();
  await expect(page.locator(".rule-detail")).toHaveCount(0);
  await expect(page.locator(".rule-content")).not.toHaveAttribute(
    "aria-expanded",
  );
  await page.clock.runFor(60000);
  await visibility(page, "hidden");
  await page.clock.runFor(180000);
  await expect(page.getByRole("button", { name: "查看帮助" })).toHaveCount(0);
  await visibility(page, "visible");
  await page.clock.runFor(59000);
  await expect(page.getByRole("button", { name: "查看帮助" })).toHaveCount(0);
  await page.clock.runFor(1001);
  await page.getByRole("button", { name: "查看帮助" }).click();
  await page.getByRole("button", { name: "暂不需要" }).click();
  await page.clock.runFor(120001);
  await expect(page.getByRole("button", { name: "查看帮助" })).toHaveCount(0);
  await editor.fill("a".repeat(21));
  await page.clock.runFor(1601);
  await expect(page.locator(rows)).toHaveCount(2);
  await page.clock.runFor(120001);
  await page.getByRole("button", { name: "查看帮助" }).click();
  await page.getByRole("button", { name: "查看详情" }).click();
  await expect(page.locator(".toast")).toHaveCount(0);
  await expect(page.locator(".detail-chevron")).toHaveCount(2);
  await page.locator(".rule-content").first().focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(rows).first().locator(".rule-detail"),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(rows)).toHaveCount(2);
  await page.locator(".rule-content").first().click();
  await expect(
    page.locator(rows).first().locator(".rule-detail"),
  ).toBeVisible();
});
test("IME and background keep reading intervals; focus alone does not open character dialog", async ({
  page,
}) => {
  await page.clock.install();
  await enter(page);
  const editor = page.getByLabel("密码", { exact: true });
  await editor.fill("tiny");
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await editor.evaluate((el: HTMLTextAreaElement, witness) => {
    (window as any).originalEditor = el;
    el.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    el.value = witness;
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  }, game.witness);
  await page.clock.runFor(5000);
  await expect(page.locator(rows)).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "继续", exact: true }),
  ).toBeDisabled();
  await editor.evaluate((el) =>
    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })),
  );
  await page.clock.runFor(1601);
  await expect(page.locator(rows)).toHaveCount(2);
  await visibility(page, "hidden");
  await page.clock.runFor(10000);
  await expect(page.locator(rows)).toHaveCount(2);
  await visibility(page, "visible");
  await page.clock.runFor(1600);
  await expect(page.locator(rows)).toHaveCount(2);
  await page.clock.runFor(20);
  await expect(page.locator(rows)).toHaveCount(3);
  await editor.fill("a".repeat(21));
  await page.clock.runFor(1601);
  await editor.evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(4, 8),
  );
  await page.clock.runFor(250);
  expect(
    await editor.evaluate((el) => el === (window as any).originalEditor),
  ).toBe(true);
  expect(
    await editor.evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
    ]),
  ).toEqual([4, 8]);
  await page.getByRole("button", { name: "字符说明" }).focus();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "字符说明", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "字符说明" })).toBeFocused();
});
test("zero-reveal draft and unknown version are preserved; five desktop widths stay usable", async ({
  page,
}, info) => {
  await enter(page);
  const editor = page.getByLabel("密码", { exact: true });
  await editor.fill("draft");
  await page.reload();
  await expect(editor).toHaveValue("draft");
  await expect(page.locator(rows)).toHaveCount(0);
  await editor.fill("鱼".repeat(257));
  await expect(page.locator("#format-error")).toHaveCount(0);
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(page.locator("#format-error")).toContainText("256");
  await editor.fill("a".repeat(8193));
  await expect(editor).toHaveValue("a".repeat(8193));
  await expect(page.locator("#format-error")).toContainText("太长");
  await expect(page.getByRole("link", { name: "GitHub 主页" })).toHaveAttribute(
    "href",
    "https://github.com/EggYDX",
  );
  if (info.project.name === "chrome") {
    await editor.fill("Notebook39!");
    mkdirSync(captures, { recursive: true });
    for (const [width, height] of [
      [1280, 720],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
      [2560, 1440],
    ]) {
      await page.setViewportSize({ width, height });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        path: `${captures}/${width}-password.png`,
        animations: "disabled",
      });
    }
  }
  await page.goto(url("registration", "4"));
  await expect(page.getByRole("alert")).toContainText("链接已失效");
});
test.describe("touch layout", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
  test("invitation, touch inspection, narrow and landscape layouts", async ({
    page,
  }, info) => {
    await page.clock.install();
    await page.goto(url());
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
      "INPUT",
    );
    await page.getByRole("button", { name: "输入邀请码", exact: true }).click();
    const ticket = page.getByRole("dialog", {
      name: "使用邀请码",
      exact: true,
    });
    await expect(ticket).toBeVisible();
    await page.getByLabel("邀请码", { exact: true }).fill("registration");
    if (info.project.name === "chrome") {
      mkdirSync(captures, { recursive: true });
      await page.screenshot({ path: `${captures}/375-invite.png` });
    }
    await page.getByRole("button", { name: "确认", exact: true }).click();
    await expect(ticket).toHaveCount(0);
    await page.getByLabel("账户名", { exact: true }).fill("手机玩家");
    await page.getByRole("button", { name: "继续", exact: true }).click();
    const editor = page.getByLabel("密码", { exact: true });
    await editor.fill("tiny");
    await page.getByRole("button", { name: "继续", exact: true }).click();
    await page.locator(".rule-content").tap();
    await expect(page.locator(".rule-detail")).toHaveCount(0);
    await page.clock.runFor(120001);
    await page.getByRole("button", { name: "查看帮助" }).tap();
    await page.getByRole("button", { name: "查看详情" }).tap();
    await editor.fill("Notebook39!");
    await page.locator(".rule-content").tap();
    await expect(page.locator(".rule-detail")).toBeVisible();
    await page.clock.runFor(4001);
    for (const [width, height] of [
      [320, 568],
      [375, 812],
      [430, 932],
      [740, 360],
    ]) {
      await page.setViewportSize({ width, height });
      await page.locator(".site-signature").scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await expect(page.locator(".rule-copy")).toBeVisible();
      if (info.project.name === "chrome")
        await page.screenshot({
          path: `${captures}/${width}-touch.png`,
          fullPage: true,
          animations: "disabled",
        });
    }
  });
});
test("Pages subpath production boot and diagnostics need no dev server", async ({
  browser,
}) => {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    const path = new URL(req.url!, "http://127.0.0.1").pathname;
    if (!path.startsWith("/JianyeGame/") || path.includes("..")) {
      res.writeHead(404).end();
      return;
    }
    const relative = path.slice("/JianyeGame/".length) || "index.html";
    try {
      const file = resolve("dist", relative),
        data = readFileSync(file);
      res.setHeader(
        "Content-Type",
        (
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".woff2": "font/woff2",
          } as Record<string, string>
        )[extname(file)] ?? "application/octet-stream",
      );
      res.end(data);
      requests.push(relative);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const context = await browser.newContext({ offline: false });
  try {
    await context.route(/^https?:\/\//, (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    await page.goto(
      `http://127.0.0.1:${address.port}/JianyeGame/?seed=registration&v=${CONTENT_VERSION}`,
    );
    await invite(page, "registration");
    await expect(page.locator(".toast")).toHaveText("邀请码已使用");
    await invite(page, "EggYDX");
    await expect(
      page.getByRole("img", { name: "可以完成", exact: true }),
    ).toBeVisible();
    expect(requests).toContain("assets/app.js");
    expect(requests).toContain("assets/app.css");
    expect(requests.some((path) => path.startsWith("src/"))).toBe(false);
  } finally {
    await context.close();
    await new Promise<void>((r, reject) =>
      server.close((e) => (e ? reject(e) : r())),
    );
  }
});
test("input performance with all rules: 50 samples and no long task", async ({
  browser,
}, info) => {
  test.skip(
    !["chrome", "edge", "chromium"].includes(info.project.name),
    "Chromium Long Task API.",
  );
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(
    ({ key, saved }) => sessionStorage.setItem(key, JSON.stringify(saved)),
    {
      key: SESSION_KEY,
      saved: {
        seed: game.plan.seed,
        version: CONTENT_VERSION,
        username: "性能",
        raw: "",
        revealedCount: game.plan.rules.length,
        complete: false,
      },
    },
  );
  try {
    const page = await context.newPage();
    await page.goto(url());
    await expect(page.locator(rows)).toHaveCount(game.plan.rules.length);
    await page.evaluate(() => document.fonts.ready);
    const measurements = await page.evaluate(async () => {
      const longTasks: number[] = [],
        sync: number[] = [],
        frame: number[] = [];
      const observer = new PerformanceObserver((list) =>
        list.getEntries().forEach((e) => longTasks.push(e.duration)),
      );
      observer.observe({ type: "longtask", buffered: false });
      const editor = document.querySelector("textarea")!;
      for (let i = 0; i < 50; i++) {
        editor.value = "A9!鱼".repeat(63) + String(i).padStart(4, "0");
        const start = performance.now();
        editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        sync.push(performance.now() - start);
        await new Promise<void>((r) =>
          requestAnimationFrame(() => {
            frame.push(performance.now() - start);
            r();
          }),
        );
      }
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      observer.disconnect();
      const p95 = (a: number[]) =>
        a.sort((a, b) => a - b)[Math.ceil(a.length * 0.95) - 1];
      return {
        samples: 50,
        graphemes: 256,
        syncP95Ms: p95(sync),
        nextFrameP95Ms: p95(frame),
        longTasks,
      };
    });
    mkdirSync("reports", { recursive: true });
    writeFileSync(
      `reports/input-${info.project.name}-v${CONTENT_VERSION}.json`,
      JSON.stringify(
        {
          browser: await browser.version(),
          protocol: new URL(root).protocol,
          rules: game.plan.rules.length,
          ...measurements,
        },
        null,
        2,
      ),
    );
    expect(measurements.longTasks.filter((t) => t > 50)).toEqual([]);
  } finally {
    await context.close();
  }
});

test("rule order stays fixed and non-prefix progress re-enables assistance", async ({
  page,
}) => {
  await page.clock.install();
  const wordRule = game.plan.rules.find((r) => r.definitionId === "word")!;
  const revealed = wordRule.ordinal;
  await page.addInitScript(
    ({ key, saved }) => sessionStorage.setItem(key, JSON.stringify(saved)),
    {
      key: SESSION_KEY,
      saved: {
        seed: "registration",
        version: CONTENT_VERSION,
        username: "顺序",
        raw: "b".repeat(21),
        revealedCount: revealed,
        complete: false,
      },
    },
  );
  await page.goto(url());
  await expect(page.locator(rows)).toHaveCount(revealed);
  const ordinals = () =>
    page
      .locator(rows)
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-ordinal")),
      );
  const expectedOrder = Array.from({ length: revealed }, (_, i) =>
    String(revealed - i),
  );
  expect(await ordinals()).toEqual(expectedOrder);
  await expect(page.locator('[data-ordinal="1"]')).toHaveAttribute(
    "data-passed",
    "true",
  );
  await page.clock.runFor(120001);
  await page.getByRole("button", { name: "查看帮助" }).click();
  await page.getByRole("button", { name: "暂不需要" }).click();
  const word = wordRule.predicate;
  if (word.kind !== "contains") throw new Error("Expected word material");
  await page
    .getByLabel("密码", { exact: true })
    .fill("b".repeat(21) + word.options[0]);
  await expect(page.locator(`[data-ordinal="${revealed}"]`)).toHaveAttribute(
    "data-passed",
    "true",
  );
  await expect(page.locator('[data-ordinal="2"]')).toHaveAttribute(
    "data-passed",
    "false",
  );
  expect(await ordinals()).toEqual(expectedOrder);
  await expect(page.getByRole("button", { name: "查看帮助" })).toHaveCount(0);
  await page.clock.runFor(119000);
  await expect(page.getByRole("button", { name: "查看帮助" })).toHaveCount(0);
  await page.clock.runFor(1001);
  await expect(page.getByRole("button", { name: "查看帮助" })).toBeVisible();
  await page.getByLabel("密码", { exact: true }).fill("");
  expect(await ordinals()).toEqual(expectedOrder);
});

test("rule order preserves a scrolled reading anchor when another requirement appears", async ({
  page,
}) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.addInitScript(
    ({ key, saved }) => sessionStorage.setItem(key, JSON.stringify(saved)),
    {
      key: SESSION_KEY,
      saved: {
        seed: "registration",
        version: CONTENT_VERSION,
        username: "阅读",
        raw: game.witness,
        revealedCount: 12,
        complete: false,
      },
    },
  );
  await page.goto(url());
  await expect(page.locator(rows)).toHaveCount(12);
  const anchor = await page.locator(".rule-list").evaluate((list) => {
    list.scrollTop = 150;
    const top = list.getBoundingClientRect().top;
    const row = [...list.querySelectorAll<HTMLElement>("[data-id]")].find(
      (row) => row.getBoundingClientRect().top >= top,
    )!;
    return {
      id: row.dataset.id!,
      offset: row.getBoundingClientRect().top - top,
      scroll: list.scrollTop,
    };
  });
  expect(anchor.scroll).toBeGreaterThan(24);
  await page.clock.runFor(1601);
  await expect(page.locator(rows)).toHaveCount(13);
  await expect(page.getByRole("button", { name: "查看新要求" })).toBeVisible();
  const offset = await page
    .locator(`[data-id="${anchor.id}"]`)
    .evaluate(
      (row) =>
        row.getBoundingClientRect().top -
        row.closest("ol")!.getBoundingClientRect().top,
    );
  expect(Math.abs(offset - anchor.offset)).toBeLessThan(2);
  await page.getByRole("button", { name: "查看新要求" }).click();
  await expect(page.getByRole("button", { name: "查看新要求" })).toHaveCount(0);
  expect(
    await page.locator(".rule-list").evaluate((list) => list.scrollTop),
  ).toBeLessThan(16);
});
