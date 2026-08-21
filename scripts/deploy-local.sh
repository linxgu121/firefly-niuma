#!/usr/bin/env bash
# 本地构建并部署到阿里云 ECS（不需要 GitHub Actions / SSH）
#
# 用法：
#   pnpm deploy                        完整流程：构建 + 打包 + 上传 + 切换 + 验证
#   DEPLOY_SKIP_BUILD=1 pnpm deploy    跳过构建（dist 已是最新时）
#
# 依赖（已在本机配置好）：
#   - WSL Ubuntu 中的 workbench CLI（~/.local/bin/workbench，凭证在 ~/.workbench/config.json）
#   - 服务器侧 /var/www/firefly 由 nginx 托管，详见 docs/阿里云部署指南.md
set -euo pipefail

cd "$(dirname "$0")/.."

# 仓库的 WSL 路径（pwd -W 形如 D:/JavaToWork/Firefly-niuma）
WIN_PATH="$(pwd -W)"
REPO_WSL="/mnt/$(echo "${WIN_PATH:0:1}" | tr "A-Z" "a-z")${WIN_PATH:2}"

echo "==> [1/4] 构建站点"
if [ "${DEPLOY_SKIP_BUILD:-0}" != "1" ]; then
	pnpm build
else
	echo "    （跳过构建）"
fi

echo "==> [2/4] 打包 dist 与文章备份"
tar czf deploy-dist.tar.gz -C dist .
tar czf deploy-content.tar.gz -C src/content posts

echo "==> [3/4] 上传并切换服务器站点"
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-26.04 -- bash "$REPO_WSL/scripts/deploy-server.sh" "$REPO_WSL"

echo "==> [4/4] 线上验证"
sleep 2
curl -s --connect-timeout 15 https://lingdi000721.cn/ \
	| grep -o "<title>[^<]*</title>" \
	|| echo "（未能从首页解析到 title，请手动打开 https://lingdi000721.cn 检查）"

rm -f deploy-dist.tar.gz deploy-content.tar.gz
echo "✔ 部署完成：https://lingdi000721.cn"
