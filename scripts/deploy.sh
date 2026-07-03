#!/bin/bash
# WeCom Bot WebChat - 部署脚本
# 用于生产环境部署
# 注意：由杨戬负责实际部署，此脚本为参考

set -e

echo "=== WeCom Bot WebChat 部署脚本 ==="

# 配置
APP_DIR="/opt/wecom-bot-webchat"
NODE_ENV="production"

# 1. 检查环境
echo "[1/5] 检查环境..."
if ! command -v node &> /dev/null; then
    echo "错误: Node.js 未安装"
    exit 1
fi
echo "Node.js $(node -v)"

# 2. 安装 Server 依赖
echo "[2/5] 安装后端依赖..."
cd "$APP_DIR/server"
npm install --omit=dev

# 3. 安装 Client 依赖并构建
echo "[3/5] 安装并构建前端..."
cd "$APP_DIR/client"
npm install
NODE_ENV=production npm run build

# 4. 创建 .env 文件（如果不存在）
echo "[4/5] 配置环境变量..."
if [ ! -f "$APP_DIR/server/.env" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/server/.env"
    echo "请编辑 $APP_DIR/server/.env 填写配置"
fi

# 5. 初始化数据库
echo "[5/5] 初始化数据库..."
cd "$APP_DIR/server"
NODE_ENV=production node db/migrate.js

echo ""
echo "=== 部署完成 ==="
echo ""
echo "下一步："
echo "1. 编辑 server/.env 配置 JWT_SECRET 等"
echo "2. 使用 systemd 管理服务：sudo systemctl start wecom-bot-webchat"
echo "3. 检查状态：sudo systemctl status wecom-bot-webchat"
echo "4. 查看日志：sudo journalctl -u wecom-bot-webchat -f"
