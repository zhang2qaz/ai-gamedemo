#!/bin/bash
# =====================
# 双击我，开一局双人剧本杀《摇摆州》（macOS）
# 我会自动：检查电脑环境 → 第一次时下载需要的组件 → 准备游戏 → 打开浏览器。
# 这个黑色窗口就是游戏服务器：玩的时候不要关；玩完了直接关掉即可。
# =====================

cd "$(dirname "$0")" || exit 1
# 从访达双击运行时，找不到 Homebrew / nvm 装的 Node，这里补上常见位置
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

title() { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() {
  printf '\n\033[31m%s\033[0m\n\n' "$1"
  read -n 1 -s -r -p "按任意键关闭这个窗口……"
  exit 1
}
open_url() { command -v open >/dev/null 2>&1 && open "$1"; }

clear
echo "🕵️  双人剧本杀《摇摆州》"
echo "    这个黑色窗口就是游戏服务器：玩的时候请不要关掉它。"

# 1. 检查 Node.js（游戏运行需要它）
if ! command -v node >/dev/null 2>&1; then
  open_url "https://nodejs.org/zh-cn/download"
  fail "这台电脑还没有安装 Node.js（游戏运行需要它）。
已经帮你打开了下载页面：下载「LTS」版的 macOS 安装包，双击装好后，再双击我一次就行。"
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 20 ]; then
  open_url "https://nodejs.org/zh-cn/download"
  fail "这台电脑上的 Node.js 版本太旧了（需要 20 或更新）。
已经帮你打开了下载页面：装好新版后，再双击我一次就行。"
fi

# 2. 第一次运行：下载游戏需要的组件
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  title "第一次准备：正在下载游戏需要的组件（大约 1～3 分钟，请稍等）……"
  npm install --no-audit --no-fund --loglevel=error || fail "下载组件失败了。请检查网络，然后再双击我一次。"
fi

# 3. 准备游戏（只在第一次、或游戏有更新时需要，大约 1 分钟）
if [ ! -f .next/BUILD_ID ] || [ -n "$(find app components engine lib store server.ts package.json -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]; then
  title "正在准备游戏（大约 1 分钟）……"
  LOG="${TMPDIR:-/tmp}/mystery-build.log"
  if ! npx next build >"$LOG" 2>&1; then
    tail -20 "$LOG"
    fail "准备游戏时出错了。请把这个窗口截图发给 Claude。"
  fi
fi

# 4. 找一个没被占用的端口（3000 被占就用 3001……）
PORT=3000
if command -v lsof >/dev/null 2>&1; then
  while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
fi
export PORT

# 5. 这台电脑在 Wi‑Fi 里的地址（给搭档用）
IP=""
if command -v ipconfig >/dev/null 2>&1; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
fi

# 6. 启动游戏；准备好之后自动打开浏览器，并告诉你怎么叫搭档
(
  for _ in $(seq 1 90); do
    curl -s -o /dev/null "http://localhost:$PORT/mystery" && break
    sleep 1
  done
  open_url "http://localhost:$PORT/mystery"
  title "✅ 游戏已经开好了！"
  echo "   你：浏览器里已经打开了游戏，输入昵称，点「创建房间」。"
  if [ -n "$IP" ]; then
    echo "   搭档（和你连同一个 Wi‑Fi）：在手机或电脑的浏览器里打开下面这个地址，输入房间号加入："
    printf '\n        \033[1;33mhttp://%s:%s/mystery\033[0m\n\n' "$IP" "$PORT"
  fi
  echo "   玩完了：直接关掉这个窗口就行。"
) &

npx tsx server.ts >/dev/null 2>"${TMPDIR:-/tmp}/mystery-server.log" || fail "游戏服务器意外停止了。请把这个窗口截图发给 Claude。"
