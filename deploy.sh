#!/usr/bin/env bash
# 在服务器上：与 package.json 同目录，chmod +x deploy.sh
# 环境变量（可选）：
#   DEPLOY_BRANCH=main
#   PM2_APP_NAME=rag-search
#   PORT=3035
# 构建前需能读到 NEXT_PUBLIC_*（见服务器 .env.production 或在下方 export）
# 若用单独 Deploy Key 拉私库，取消下面 GIT_SSH_COMMAND 的注释并改路径
# export GIT_SSH_COMMAND='ssh -i /root/.ssh/github_deploy -o IdentitiesOnly=yes'

cd "$(dirname "$0")"

set +u
if [ -f /etc/profile ]; then
  # shellcheck source=/dev/null
  . /etc/profile
fi
if [ -f "${HOME}/.bash_profile" ]; then
  # shellcheck source=/dev/null
  . "${HOME}/.bash_profile"
elif [ -f "${HOME}/.bashrc" ]; then
  # shellcheck source=/dev/null
  . "${HOME}/.bashrc"
fi
if [ -f "${HOME}/.profile" ]; then
  # shellcheck source=/dev/null
  . "${HOME}/.profile"
fi
export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "${NVM_DIR}/nvm.sh"
fi
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
  if [ -f package.json ] && command -v node >/dev/null 2>&1; then
    PM_PKG=$(node -p "require('./package.json').packageManager||''" 2>/dev/null || echo "")
    if [ -n "${PM_PKG}" ]; then
      corepack prepare "${PM_PKG}" --activate
    fi
  fi
fi
export PATH="${HOME}/.local/share/pnpm:/usr/local/bin:${PATH}"

set -u
set -e
set -o pipefail

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm 不在 PATH 中。请在服务器执行: which pnpm"
  exit 127
fi

pnpm --version >&2 || true

BRANCH="${DEPLOY_BRANCH:-main}"
APP_NAME="${PM2_APP_NAME:-rag-search}"
PORT="${PORT:-3035}"
NEXT_BIN="$(pwd)/node_modules/next/dist/bin/next"

echo "==> deploy: $(pwd) branch=${BRANCH}"

git fetch origin
git reset --hard "origin/${BRANCH}"

if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile || pnpm install
else
  pnpm install
fi

pnpm run build

if [ ! -f "$NEXT_BIN" ]; then
  echo "ERROR: 未找到 Next 可执行文件（请先成功执行 pnpm run build）: $NEXT_BIN"
  exit 1
fi

export NODE_ENV=production

if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start "$NEXT_BIN" --name "$APP_NAME" --cwd "$(pwd)" --interpreter node -- start -p "$PORT"
fi

pm2 save

echo "==> deploy done: ${APP_NAME} port=${PORT}"
