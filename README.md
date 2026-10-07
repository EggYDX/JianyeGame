# <img src="images/jianye-logo.svg" width="32" height="32" alt=""> 间页 · JianyeGame

[English](README.EN.md)

**[开始游戏](https://eggydx.github.io/JianyeGame/)**

<p align="center">
  <img src="images/registration.png" width="75%" alt="空白的创建账号页面">
</p>

你只是想注册「间页」。

名字已经想好了。页面上没有别的事，只剩一个密码框。

你输入一串自己记得住的字符，点下「继续」。有一处不合要求，改掉就好。

这次通过了。

你正准备离开，下面却又多了一行。你补上几个字符，再改一改顺序。刚才通过的那一处，又变红了。

也许只是这个网站讲究一点。

可你已经删了又写，写了又删。「继续」还在那里，注册似乎还差那么一点。

先把账号注册完吧。

## 游戏里有什么

- 同一个密码，需要满足越来越多的要求。
- 字符放在哪里，有时比写了多少更重要。
- 使用别人发给你的邀请码来感同身受吧！

## 怎么玩

1. 输入账户名，进入密码页。
2. 写下密码，点「继续」。
3. 按页面上的要求修改密码。
4. 全部满足后，再点「继续」完成注册。

剩下的，由你来挖掘

## 本地运行

需要 Node.js 24+ 和 pnpm 11。

### 开发运行

```bash
pnpm install --frozen-lockfile
pnpm dev
```

默认打开 `http://127.0.0.1:5173/dev.html`。

### 离线构建

```bash
pnpm build
```

构建结果在 `dist/`。直接打开 `dist/index.html` 就能离线游玩；复制时请保留整个 `dist/` 目录。

### GitHub Pages 发布

在仓库的 **Settings → Pages** 中，将 **Source** 设为 **GitHub Actions**。之后每次更新 `main`，GitHub 都会自动发布[游戏](https://eggydx.github.io/JianyeGame/)。

需要重新发布时，在 **Actions → Deploy GitHub Pages** 中点击 **Run workflow**。

## 关于输入的密码

JianyeGame 是密码谜题游戏，请不要输入现实中正在使用的真实密码。游戏逻辑在浏览器本地执行；为恢复当前进度，账户名和游戏输入可能暂存在当前浏览器会话的 `sessionStorage` 中。

## 开发与测试

邀请码决定这一局的谜题，开始前会检查是否有解。项目包含单元测试、性质测试和浏览器测试。

```bash
pnpm test
pnpm test:quick
pnpm test:generation
pnpm build
pnpm test:e2e
pnpm format:check
```

提交 Pull Request 时，GitHub 会检查代码格式、构建、单元测试、性质测试和少量 Chromium 浏览器测试。合并到 `main` 后，还会用 Chromium、Firefox 和 WebKit 跑完整浏览器测试。

本地浏览器测试支持 Chrome、Edge、Firefox 和 WebKit，需要先安装对应浏览器。生成测试的结果保存在 `reports/generation.json`。

## 技术栈

- React、TypeScript
- Vite、esbuild
- CSS、Web Animations API
- pure-rand、unicode-segmenter
- Vitest、fast-check、Playwright（测试）

## 项目状态

能完整游玩。难度和手机操作还需要更多试玩。

## License

本项目的原创代码以 [MIT License](LICENSE) 开源。

项目使用的第三方库、字体、图标及其他依赖可能适用各自的许可证与版权声明，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
