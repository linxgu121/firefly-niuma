<div align="center">

# niuma's Blog

> 一个游戏开发者的个人博客 · UE / Unity 学习与实战笔记
>
> 基于 **Astro + Tailwind CSS** 构建，衍生自开源主题 [Firefly](https://github.com/CuteLeaf/Firefly)（上游 [fuwari](https://github.com/saicaca/fuwari)）

![Astro](https://img.shields.io/badge/Astro-7.2-orange)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.x-38bdf8)
![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![pnpm](https://img.shields.io/badge/pnpm-11-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Version](https://img.shields.io/badge/version-miuma%20v1.1.6-165)

**在线访问**：[lingdi000721.cn](https://lingdi000721.cn)

</div>

---

## ✨ 项目简介

本站从 Firefly 主题深度改造而来：不再走"Git 推送 → CI 构建 → 部署"的传统路线，而是**本地构建 + 直传自有服务器**——写完文章一条命令上线，文章数据只保存在本机与服务器备份，不进任何代码仓库。

## 🚀 快速开始

```bash
git clone https://github.com/linxgu121/firefly-niuma.git
cd firefly-niuma
pnpm install
pnpm dev        # 本地开发 http://localhost:4321
```

## ⚙️ 常用指令

| 命令 | 作用 |
| :-- | :-- |
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm build` | 完整构建（含 LQIP、字体子集、Pagefind 搜索索引） |
| `pnpm deploy` | **一键上线**：构建 → 打包 → 直传阿里云 ECS → 原子切换 |
| `pnpm new-post <文件名>` | 创建新文章 |
| `pnpm check` / `pnpm type-check` | 代码 / 类型检查 |
| `pnpm format` / `pnpm lint` | Biome 格式化 / 检查 |

## 🎨 相对上游主题的主要改造

- **部署管线**：本地构建经阿里云 Workbench 通道直传 ECS（无需 SSH / GitHub Actions），服务器原子切换 + 上一版保留回滚，详见 [docs/阿里云部署指南.md](docs/阿里云部署指南.md)
- **首页 Hero**：`Play & Build` 打字机副标题 + 居中圆形头像简介，浮于动态壁纸之上
- **发文日历**：重写为细长极简版（单月视图、圆点标记、当日文章展开）
- **导航栏**：菜单右对齐、整体缩小；右侧边栏窄化（240px）并精简为日历 + 站点信息
- **设计系统**：MiSans 正文字体、语义颜色令牌、玻璃卡片材质、壁纸自适应取色（AdaptivePalette）
- **内容隔离**：文章与音乐文件不进仓库（`.gitignore` 隔离，随部署自动备份到服务器）
- **HTML 缓存策略**：`no-cache` + ETag 协商缓存，发布后立即可见

## 🙏 致谢与上游

- 本项目衍生自 **[CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly)**，感谢原作者的开发与开源
- Firefly 基于 **[saicaca/fuwari](https://github.com/saicaca/fuwari)** 模板二次开发
- 原作者的 README / 贡献指南等文档已在本地归档保留（`docs/原作者-*`，不上传仓库）

## 📝 许可协议

本项目遵循 [MIT License](./LICENSE) 开源协议，并按要求保留上游（saicaca / CuteLeaf）的版权声明。

若你参考或使用了本项目的组件设计与代码，请注明来自本仓库及上游 Firefly。
