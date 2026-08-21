#!/usr/bin/env bash
# 在 WSL 中执行：上传部署包到 ECS 并原子切换（由 deploy-local.sh 调用，勿直接运行）
#
# 服务器侧动作：
#   1. 上传 dist 包和文章备份包（经阿里云 OSS 中转）
#   2. 站点原子切换：.new 解压 → 旧目录改名 .old（保留一份用于回滚）→ 换入
#   3. 文章备份存入 /root/blog-backup/，保留最近 10 份
set -euo pipefail

WB="$HOME/.local/bin/workbench"
INSTANCE_ID="i-2zech1srlbga4x8kzqqv"
REPO_WSL="$1"

echo "  上传 dist 包..."
"$WB" upload "$REPO_WSL/deploy-dist.tar.gz" /tmp/firefly-dist.tar.gz \
	--instance-id "$INSTANCE_ID" >/dev/null
echo "  上传文章备份包..."
"$WB" upload "$REPO_WSL/deploy-content.tar.gz" /tmp/firefly-content.tar.gz \
	--instance-id "$INSTANCE_ID" >/dev/null

echo "  服务器切换..."
"$WB" exec --instance-id "$INSTANCE_ID" --timeout 180 --command '
set -e
rm -rf /var/www/firefly.new && mkdir /var/www/firefly.new
tar xzf /tmp/firefly-dist.tar.gz -C /var/www/firefly.new
rm -rf /var/www/firefly.old
[ -d /var/www/firefly ] && mv /var/www/firefly /var/www/firefly.old
mv /var/www/firefly.new /var/www/firefly
mkdir -p /root/blog-backup
mv /tmp/firefly-content.tar.gz "/root/blog-backup/content-$(date +%Y%m%d-%H%M%S).tar.gz"
ls -1t /root/blog-backup/content-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
rm -f /tmp/firefly-dist.tar.gz
echo "  SWITCHED: $(ls /var/www/firefly | wc -l) 个文件已上线，上一版本保留在 /var/www/firefly.old"
'
