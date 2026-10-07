# <img src="images/jianye-logo.svg" width="32" height="32" alt=""> 间页 · JianyeGame

[简体中文](README.md)

**[Play](https://eggydx.github.io/JianyeGame/)**

<p align="center">
  <img src="images/registration.png" width="75%" alt="空白的创建账号页面">
</p>

You came to Jianye to make an account.

You've picked a username. All that's left is a password.

You type something you'll remember and press Continue. One small correction. Fair enough.

That does it.

Except another line has appeared.

You add a few characters. Move a few around. Something that was fine a moment ago turns red.

Perhaps this website is just fussy.

After a few more edits, the password barely looks like the one you started with. The Continue button hasn't moved. You're less sure where it's taking you.

Might as well finish signing up.

## What you're playing

- One password has to satisfy **a growing list of requirements**.
- Where you put a character can matter as much as what you add.
- Use the invitation code someone sent you and experience it for yourself!

## How to play

1. Choose a username.
2. Enter a password and press **继续** (Continue).
3. Adjust it to meet the requirements on the page.
4. Once everything passes, press Continue to finish signing up.

The rest is yours to find out.

## Run locally

You'll need Node.js 24+ and pnpm 11.

### Development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

By default, the development page opens at `http://127.0.0.1:5173/dev.html`.

### Offline build

```bash
pnpm build
```

The build goes into `dist/`. Open `dist/index.html` directly to play offline; keep the entire `dist/` directory when copying it.

### GitHub Pages deployment

In the repository's **Settings → Pages**, choose **GitHub Actions** under **Source**. GitHub will publish the [game](https://eggydx.github.io/JianyeGame/) automatically whenever `main` is updated.

To publish again, go to **Actions → Deploy GitHub Pages** and click **Run workflow**.

## About the password you enter

JianyeGame is a password puzzle game. Do not enter a real password you currently use elsewhere. The game logic runs locally in the browser. To restore progress, the username and game input may be temporarily stored in the current browser session's `sessionStorage`.

## Development and tests

The invitation code determines the puzzle, which is checked for a solution before play. The project includes unit, property, and browser tests.

```bash
pnpm test
pnpm test:quick
pnpm test:generation
pnpm build
pnpm test:e2e
pnpm format:check
```

For each pull request, GitHub checks code formatting, the build, unit and property tests, and a small set of Chromium browser tests. After a merge to `main`, it also runs the full browser tests in Chromium, Firefox, and WebKit.

Local browser tests support Chrome, Edge, Firefox, and WebKit; install the corresponding browsers first. Generation test results are saved in `reports/generation.json`.

## Built with

- React, TypeScript
- Vite, esbuild
- CSS, Web Animations API
- pure-rand, unicode-segmenter
- Vitest, fast-check, Playwright (tests)

## Project status

Playable from start to finish. Difficulty and phone controls still need more playtesting.

## License

Original code in this project is licensed under the [MIT License](LICENSE).

Third-party libraries, fonts, icons, and other dependencies may be subject to their own licenses and copyright notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.
