# 先坐一下

一个关于下班回家后，为什么迟迟还没去洗澡的轻量剧情互动小游戏。

## 在线发布

本项目是纯静态网页，不需要安装依赖或执行构建命令。

1. 在 GitHub 新建一个公开仓库，例如 `xian-zuo-yi-xia`。
2. 将本目录中的全部文件上传到仓库根目录，确保 `index.html` 位于根目录。
3. 打开仓库的 `Settings` → `Pages`。
4. 在 `Build and deployment` 中将 `Source` 设为 `Deploy from a branch`。
5. Branch 选择 `main`，文件夹选择 `/(root)`，点击 `Save`。
6. 等待 GitHub 完成部署，然后在同一页面点击 `Visit site`。

项目网页地址通常为：

```text
https://你的用户名.github.io/xian-zuo-yi-xia/
```

## 本地预览

直接打开 `index.html` 即可游玩。也可以在本目录运行：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000/`。

## 文件说明

- `index.html`：网页入口
- `styles.css`：界面与动画
- `app.js`：场景、交互与渲染
- `game-core.js`：游戏状态与结算逻辑
- `assets/scenes/`：游戏场景图片

## 注意

- 不要只上传 ZIP 文件；需要先解压，再上传 ZIP 内的全部文件。
- 不要改变 `assets` 目录与入口文件的相对位置。
- GitHub Pages 发布的是公开网页，请勿向仓库加入密码、密钥或其他隐私信息。
