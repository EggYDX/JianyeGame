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

Select **GitHub Actions** under the repository's **Settings → Pages → Source**. After a merge to `main`, the Pages workflow builds from source, uploads `dist/`, and publishes the [live game](https://eggydx.github.io/JianyeGame/). It also supports manual runs. Build artifacts are not committed to Git.

Relative asset paths support `/JianyeGame/` and `?seed=...&v=5` links. This release uses content version 5. Links with older versions display “链接已失效” (link expired) instead of silently changing the challenge. Progress is stored separately for each content version.

## About the password you enter

JianyeGame is a password puzzle game. Do not enter a real password you currently use elsewhere. The game logic runs locally in the browser. To restore progress, the username and game input may be temporarily stored in the current browser session's `sessionStorage`.

## Engineering and tests

Invitation codes and content versions determine the puzzles, whose solvability is checked before play. A reducer manages the flow, a background worker prepares the puzzle, and page steps and rule animations have separate responsibilities. The project includes unit, property, and browser E2E tests.

```bash
pnpm test
pnpm test:quick
pnpm test:generation
pnpm build
pnpm test:e2e
pnpm format:check
```

PR checks cover formatting, types/build, unit and property tests, a quick generation corpus, and Chromium browser smoke tests. CI on `main` and manual runs also execute the full Chromium, Firefox, and WebKit suites. Local `pnpm test:e2e` retains Chrome, Edge, Firefox, and WebKit; install the corresponding browsers first. CI uses Playwright's official browsers. Generation balance reports go to `reports/generation.json` and are excluded from Git.

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
