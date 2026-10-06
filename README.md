# <img src="images/jianye-logo.svg" width="32" height="32" alt=""> 间页 · JianyeGame

[English](README.EN.md)

**[开始游戏](YOUR_GAME_URL)**

![空白的创建账号页面](images/registration.png)

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
- 邀请码相同，挑战也相同。
- 简体中文界面，电脑和手机浏览器都能玩。

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

### GitHub Pages 构建

```bash
pnpm pages
```

构建结果在 `dist/`，同时复制到 `docs/`。打开 `docs/index.html` 就能本地游玩。

## 技术栈

- React、TypeScript
- Vite、esbuild
- CSS、Web Animations API
- pure-rand、unicode-segmenter
- Vitest、fast-check、Playwright（测试）

## 项目状态

能完整游玩。难度和手机操作还需要更多试玩。

## License

[MIT](LICENSE)
