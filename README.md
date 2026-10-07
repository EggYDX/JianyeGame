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

仓库的 **Settings → Pages → Source** 选择 **GitHub Actions**。合并到 `main` 后，Pages workflow 从源码构建，上传 `dist/` 并发布到 [线上游戏](https://eggydx.github.io/JianyeGame/)。也可以手动运行该 workflow。构建产物不提交到 Git。

静态资源使用相对路径，支持 `/JianyeGame/` 子路径和 `?seed=...&v=5` 链接。本次内容版本为 5；带旧版本号的链接会显示“链接已失效”，不会悄悄换成另一局。旧版本进度与新版本分开保存。

## 关于输入的密码

JianyeGame 是密码谜题游戏，请不要输入现实中正在使用的真实密码。游戏逻辑在浏览器本地执行；为恢复当前进度，账户名和游戏输入可能暂存在当前浏览器会话的 `sessionStorage` 中。

## 工程与测试

谜题由邀请码和内容版本确定性生成，并在交给玩家前验证可完成性。页面沿用 reducer 管理流程，后台 worker 准备谜题，页面步骤与规则动画分别维护。项目包含 unit、property 与 browser E2E tests。

```bash
pnpm test
pnpm test:quick
pnpm test:generation
pnpm build
pnpm test:e2e
pnpm format:check
```

PR 会运行格式、类型/构建、单元与性质测试、快速生成 corpus 和 Chromium 浏览器冒烟测试。`main` 与手动 CI 还运行 Chromium、Firefox、WebKit 完整浏览器测试。本地 `pnpm test:e2e` 保留 Chrome、Edge、Firefox、WebKit，需安装对应浏览器；CI 使用 Playwright 官方浏览器。生成平衡报告写入 `reports/generation.json`，不会进入 Git。

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
