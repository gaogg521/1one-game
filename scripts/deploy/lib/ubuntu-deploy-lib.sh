#!/usr/bin/env bash
# Operone 多发行版部署共享库 — install.sh / linux-ubuntu22-full.sh 引用
# shellcheck disable=SC2034

: "${OPERONE_DIR:=/opt/operone}"
: "${OPERONE_USER:=www-data}"
: "${OPERONE_DEFAULT_GIT_REPO:=https://github.com/gaogg521/1one-game.git}"
: "${GIT_REPO:=${OPERONE_DEFAULT_GIT_REPO}}"
: "${GIT_BRANCH:=main}"
: "${OPERONE_DOMAIN:=}"
: "${CERTBOT_EMAIL:=}"
: "${OPERONE_PORT:=3000}"
: "${SKIP_SEED:=0}"
: "${SKIP_PREFLIGHT:=1}"
: "${NODE_MAJOR:=22}"

# 由调用方设置 SCRIPT_DIR；未设置时按 lib 位置推断
if [[ -z "${SCRIPT_DIR:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=os-lib.sh
source "$_LIB_DIR/os-lib.sh"
os_detect

REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

log() { printf '\033[1;34m[operone-deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[operone-deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[operone-deploy]\033[0m %s\n' "$*" >&2; exit 1; }
ok()  { printf '\033[1;32m[operone-deploy]\033[0m %s\n' "$*"; }

need_root() {
  if is_root; then
    return 0
  fi
  if [[ -n "${OPERONE_DEPLOY_SCRIPT:-}" && -f "${OPERONE_DEPLOY_SCRIPT}" ]]; then
    ensure_root_privileges "${OPERONE_DEPLOY_SCRIPT}"
  fi
  die "需要 root 权限。请执行: sudo bash ${OPERONE_DEPLOY_SCRIPT:-$0}"
}

generate_secret() {
  openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64
}

# 兼容 CentOS 7 等旧 git（1.8.3 不支持 git -C）
git_as_user_in_repo() {
  local user="$1"
  shift
  run_as_app_user "$user" bash -lc "cd $(printf '%q' "$OPERONE_DIR") && git $*"
}

# www-data/nginx 等系统用户默认家目录常为 /var/www（不可写）→ npm 报 EACCES
app_user_bash_env() {
  printf 'export HOME=%q NPM_CONFIG_CACHE=%q npm_config_cache=%q PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n' \
    "$OPERONE_DIR" "$OPERONE_DIR/.npm-cache" "$OPERONE_DIR/.npm-cache"
}

run_npm_as_app_user() {
  run_app_shell_as_user "$1"
}

run_app_shell_as_user() {
  local inner="$1"
  run_as_app_user "$OPERONE_USER" bash -lc "$(app_user_bash_env) cd $(printf '%q' "$OPERONE_DIR") && ${inner}"
}

prepare_app_user_home() {
  need_root
  ensure_app_user "$OPERONE_USER" "$OPERONE_DIR"
  mkdir -p "$OPERONE_DIR/.npm-cache" "$OPERONE_DIR/.config"
  local cur_home=""
  if id "$OPERONE_USER" &>/dev/null; then
    cur_home="$(getent passwd "$OPERONE_USER" | cut -d: -f6)"
    if [[ -n "$cur_home" && "$cur_home" != "$OPERONE_DIR" ]]; then
      log "修正 ${OPERONE_USER} 家目录 ${cur_home} → ${OPERONE_DIR}（避免 npm 写 /var/www 失败）"
      usermod -d "$OPERONE_DIR" "$OPERONE_USER" 2>/dev/null || warn "usermod 家目录失败，已用 HOME= 环境变量兜底"
    fi
  fi
  chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"
}

npm_install_deps() {
  prepare_app_user_home

  local npm_flags=()
  if is_centos7; then
    npm_flags=(--ignore-scripts)
    log "CentOS 7：npm ci --ignore-scripts（跳过 better-sqlite3 等 native 编译）…"
  else
    log "npm ci …"
  fi

  if ! run_npm_as_app_user "npm ci ${npm_flags[*]}"; then
    warn "npm ci 失败，清理 node_modules 后改用 npm install …"
    rm -rf "$OPERONE_DIR/node_modules"
    chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"
    run_npm_as_app_user "npm install --no-audit --no-fund ${npm_flags[*]}" \
      || die "npm install 失败（常见原因：磁盘满、网络、权限；请确认 ${OPERONE_USER} 可写 ${OPERONE_DIR}）"
  fi

  if is_centos7; then
    log "补装 sharp 预编译包 …"
    local ld_ds
    ld_ds="$(centos7_libstdcxx_ld_path)"
    if [[ -n "$ld_ds" ]]; then
      run_npm_as_app_user "export LD_LIBRARY_PATH='${ld_ds}':\${LD_LIBRARY_PATH:-}; node node_modules/sharp/install/check.js" \
        || warn "sharp 预编译包未就绪，封面图处理可能受影响"
    else
      run_npm_as_app_user "node node_modules/sharp/install/check.js" \
        || warn "sharp 预编译包未就绪（建议安装 devtoolset-7）"
    fi
  fi
}

# CentOS 7 libstdc++ 过旧，@parcel/watcher 原生模块需 GLIBCXX_3.4.20+；生产 build 不用文件监听
centos7_stub_parcel_watcher() {
  is_centos7 || return 0
  local w="$OPERONE_DIR/node_modules/@parcel/watcher/index.js"
  [[ -f "$w" ]] || return 0
  log "CentOS 7：@parcel/watcher 替换为 noop 桩（跳过 GLIBCXX_3.4.20 native 依赖）"
  cat > "$w" << 'STUB'
"use strict";
const noop = async () => {};
const emptySub = async () => ({ unsubscribe: noop });
exports.subscribe = emptySub;
exports.unsubscribe = noop;
exports.writeSnapshot = async () => "";
exports.getEventsSince = async () => [];
STUB
  chown "$OPERONE_USER:$OPERONE_USER" "$w" 2>/dev/null || true
}

# CentOS 7 build：限制 Node 堆 + 确保 swap（~3.7GB 内存 next build 易 OOM）
centos7_prepare_build() {
  is_centos7 || return 0
  centos7_stub_parcel_watcher
  export OPERONE_NODE_BUILD_OPTS="${OPERONE_NODE_BUILD_OPTS:---max-old-space-size=2560}"
}

centos7_build_cmd() {
  local inner="$1"
  if is_centos7; then
    local ld_ds ds_env=""
    ld_ds="$(centos7_libstdcxx_ld_path)"
    [[ -n "$ld_ds" ]] && ds_env="export LD_LIBRARY_PATH='${ld_ds}':\${LD_LIBRARY_PATH:-}; "
    echo "${ds_env}export NODE_OPTIONS=\"\${NODE_OPTIONS:-} ${OPERONE_NODE_BUILD_OPTS:---max-old-space-size=2560}\"; ${inner}"
  else
    echo "$inner"
  fi
}

centos7_configure_selinux() {
  is_centos7 || return 0
  command -v getenforce >/dev/null 2>&1 || return 0
  [[ "$(getenforce 2>/dev/null)" == "Disabled" ]] && return 0
  if command -v setsebool >/dev/null 2>&1; then
    log "CentOS 7：允许 Nginx 反代 (httpd_can_network_connect) …"
    setsebool -P httpd_can_network_connect 1 2>/dev/null || warn "setsebool 失败，Nginx 反代可能被 SELinux 拦截"
  fi
}

# Godot 4.4.1 + Web 导出模板（服务端 Godot 试玩 / HTML5 导出）
install_godot_production() {
  [[ "${SKIP_GODOT_INSTALL:-0}" == "1" ]] && return 0
  local godot_bin="$OPERONE_DIR/tools/godot/Godot_v4.4.1-stable_linux.x86_64"
  local templates_mark="$OPERONE_DIR/.local/share/godot/export_templates/4.4.1.stable/web_nothreads_release.zip"

  if is_centos7; then
    install_godot_docker_image || warn "CentOS 7 需 Docker 才能 Godot 导出"
    if id "$OPERONE_USER" &>/dev/null && getent group docker &>/dev/null; then
      usermod -aG docker "$OPERONE_USER" 2>/dev/null || true
    fi
  elif [[ ! -x "$godot_bin" ]]; then
    log "安装 Godot 二进制 …"
    run_app_shell_as_user "bash scripts/godot-install-linux.sh" \
      || warn "Godot 二进制安装失败"
  fi

  if [[ ! -f "$templates_mark" ]]; then
    log "安装 Godot Web 导出模板（~1.1GB，首次较慢）…"
    run_app_shell_as_user "XDG_DATA_HOME='$OPERONE_DIR/.local/share' bash scripts/godot-install-templates-linux.sh" \
      || warn "Godot 导出模板安装失败"
  fi

  if is_centos7 && command -v docker >/dev/null 2>&1; then
    ok "Godot: Docker 模式 (operone-godot:4.4.1)"
  elif [[ -x "$godot_bin" ]]; then
    ok "Godot: $godot_bin"
  fi
}

godot_systemd_env_block() {
  if is_centos7 && command -v docker >/dev/null 2>&1; then
    echo "Environment=GODOT_USE_DOCKER=1"
    return 0
  fi
  local godot_bin="$OPERONE_DIR/tools/godot/Godot_v4.4.1-stable_linux.x86_64"
  [[ -x "$godot_bin" ]] || return 0
  echo "Environment=GODOT_BIN=${godot_bin}
Environment=XDG_DATA_HOME=${OPERONE_DIR}/.local/share"
}

install_godot_docker_image() {
  command -v docker >/dev/null 2>&1 || return 1
  local image="${GODOT_DOCKER_IMAGE:-operone-godot:4.4.1}"
  if docker image inspect "$image" >/dev/null 2>&1; then
    log "Godot Docker 镜像已存在: $image"
    return 0
  fi
  log "构建 Godot Docker 镜像（CentOS 7 等 glibc 过旧时用于导出）…"
  docker build -f "$OPERONE_DIR/scripts/deploy/Dockerfile.godot" -t "$image" "$OPERONE_DIR" \
    || { warn "Godot Docker 镜像构建失败"; return 1; }
  ok "Godot Docker 镜像: $image"
}

prisma_migrate_deploy() {
  local allow_reset="${1:-0}"
  log "prisma migrate deploy …"
  local cmd="npx prisma migrate deploy"

  resolve_prisma_failed_migrations() {
    local out line
    out="$(run_app_shell_as_user "npx prisma migrate status" 2>&1 || true)"
    while IFS= read -r line; do
      [[ "$line" =~ ^[0-9]{8,}_ ]] || continue
      warn "标记失败迁移为 rolled-back: $line"
      run_app_shell_as_user "npx prisma migrate resolve --rolled-back '$line'" 2>/dev/null || true
    done <<< "$(echo "$out" | grep -E '^[0-9]{8,}_' || true)"
  }

  if run_app_shell_as_user "$cmd"; then
    return 0
  fi

  warn "Prisma 迁移失败，尝试 resolve 失败记录 …"
  resolve_prisma_failed_migrations
  if run_app_shell_as_user "$cmd"; then
    return 0
  fi

  if [[ "$allow_reset" != "1" ]]; then
    die "prisma migrate deploy 失败（更新模式不自动删库，请手动排查）"
  fi
  warn "仍失败，删除 prod.db 并重试（首次安装空库）…"
  rm -f "$OPERONE_DIR/prod.db" "$OPERONE_DIR/prod.db-journal" "$OPERONE_DIR/prod.db-wal" 2>/dev/null || true
  run_app_shell_as_user "$cmd" || die "prisma migrate deploy 仍失败，请查看上方日志"
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tln | grep -q ":${port} "
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tln | grep -q ":${port} "
  else
    return 1
  fi
}

wait_for_health() {
  local url="http://127.0.0.1:${OPERONE_PORT}/api/health"
  local i max="${1:-30}"
  for ((i = 1; i <= max; i++)); do
    if curl -sf "$url" >/dev/null 2>&1; then
      ok "健康检查通过: $url"
      return 0
    fi
    sleep 2
  done
  warn "健康检查超时（${max} 次），请手动: curl -v $url"
  return 1
}

phase_deps() {
  need_root
  os_validate
  log "[1/5] 安装系统依赖 …"
  is_centos7 && fix_centos7_vault_repos
  install_build_deps
  install_centos7_devtoolset || true

  # 内存 < 4GB 且 swap 不足时加 2G swap，避免 next build OOM（CentOS 7 常见 3.7GB）
  local mem_mb swap_mb
  mem_mb="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo 4096)"
  swap_mb="$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}' || echo 0)"
  if [[ "$mem_mb" -lt 4096 && "$swap_mb" -lt 512 ]] && [[ ! -f /swapfile ]]; then
    log "内存偏低，自动创建 2G swap …"
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi

  if command -v node >/dev/null 2>&1; then
    local ver
    ver="$(node -v | sed 's/v//' | cut -d. -f1)"
    if [[ "$ver" -ge "$NODE_MAJOR" ]]; then
      log "Node 已满足: $(node -v)"
      return 0
    fi
    warn "Node $(node -v) 版本偏低，将安装 Node ${NODE_MAJOR}.x"
  fi

  log "安装 Node.js ${NODE_MAJOR}.x (NodeSource) …"
  install_nodejs "$NODE_MAJOR"
  log "Node $(node -v) · npm $(npm -v)"
}

ensure_operone_dir() {
  if [[ ! -d "$OPERONE_DIR" ]]; then
    mkdir -p "$OPERONE_DIR"
  fi
  if id "$OPERONE_USER" &>/dev/null; then
    chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"
  fi
}

clone_or_update_repo() {
  ensure_operone_dir
  if [[ -d "$OPERONE_DIR/.git" ]]; then
    log "仓库已存在，git pull …"
    git_as_user_in_repo "$OPERONE_USER" fetch origin
    git_as_user_in_repo "$OPERONE_USER" checkout "$GIT_BRANCH"
    git_as_user_in_repo "$OPERONE_USER" pull --ff-only origin "$GIT_BRANCH" || true
    return 0
  fi

  if [[ -n "$GIT_REPO" ]]; then
    log "克隆 $GIT_REPO → $OPERONE_DIR"
    if [[ -d "$OPERONE_DIR" ]]; then
      if [[ -n "$(ls -A "$OPERONE_DIR" 2>/dev/null)" ]]; then
        die "$OPERONE_DIR 非空，无法克隆（请清空或换 OPERONE_DIR）"
      fi
      rmdir "$OPERONE_DIR" 2>/dev/null || rm -rf "$OPERONE_DIR"
    fi
    mkdir -p "$(dirname "$OPERONE_DIR")"
    git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO" "$OPERONE_DIR"
    chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"
    return 0
  fi

  if [[ -f "$REPO_ROOT/package.json" ]] && [[ "$REPO_ROOT" != "$OPERONE_DIR" ]]; then
    log "从当前仓库复制到 $OPERONE_DIR（未设 GIT_REPO）"
    rsync -a --exclude node_modules --exclude .next --exclude '*.db' --exclude '.git' \
      "$REPO_ROOT/" "$OPERONE_DIR/" 2>/dev/null \
      || cp -a "$REPO_ROOT/." "$OPERONE_DIR/"
    chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"
    return 0
  fi

  if [[ -f "$OPERONE_DIR/package.json" ]]; then
    log "使用已有目录 $OPERONE_DIR"
    return 0
  fi

  die "无法获取源码：请设置 GIT_REPO=... 或在仓库根目录执行本脚本"
}

write_env_if_missing() {
  local env_file="$OPERONE_DIR/.env"
  if [[ -f "$env_file" ]]; then
    log ".env 已存在，跳过生成"
    return 0
  fi

  [[ -f "$OPERONE_DIR/.env.example" ]] || die "缺少 $OPERONE_DIR/.env.example"

  log "从 .env.example 生成 .env"
  run_as_app_user "$OPERONE_USER" cp "$OPERONE_DIR/.env.example" "$env_file"
  run_as_app_user "$OPERONE_USER" sed -i 's|^DATABASE_URL=.*|DATABASE_URL="file:./prod.db"|' "$env_file"

  if [[ -z "${SUPER_ADMIN_SECRET:-}" ]]; then
    SUPER_ADMIN_SECRET="$(generate_secret)"
    warn "已自动生成 SUPER_ADMIN_SECRET（请妥善保存）"
  fi

  append_env() {
    local key="$1" val="$2"
    [[ -z "$val" ]] && return 0
    if grep -q "^${key}=" "$env_file"; then
      run_as_app_user "$OPERONE_USER" sed -i "s|^${key}=.*|${key}=${val}|" "$env_file"
    else
      echo "${key}=${val}" >> "$env_file"
    fi
  }

  append_env "NODE_ENV" "production"
  append_env "PORT" "${OPERONE_PORT}"
  append_env "OPENAI_API_KEY" "${OPENAI_API_KEY:-}"
  append_env "OPENAI_BASE_URL" "${OPENAI_BASE_URL:-https://litellm-internal.123u.com}"
  append_env "SUPER_ADMIN_SECRET" "${SUPER_ADMIN_SECRET:-}"
  append_env "RUNTIME_CONFIG_SECRET" "${RUNTIME_CONFIG_SECRET:-${SUPER_ADMIN_SECRET:-}}"

  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    warn "OPENAI_API_KEY 未填 — 服务可启动，LLM 走 mock；装完后编辑 $env_file 并 systemctl restart operone"
  fi
}

merge_env_key() {
  local key="$1" val="$2"
  local env_file="$OPERONE_DIR/.env"
  [[ -z "$val" ]] && return 0
  [[ -f "$env_file" ]] || return 0
  if grep -q "^${key}=" "$env_file"; then
    run_as_app_user "$OPERONE_USER" sed -i "s|^${key}=.*|${key}=${val}|" "$env_file"
  else
    echo "${key}=${val}" >> "$env_file"
  fi
}

phase_app() {
  need_root
  log "[2/5] 拉取代码并构建 …"
  ensure_app_user "$OPERONE_USER" "$OPERONE_DIR"

  clone_or_update_repo
  write_env_if_missing

  merge_env_key "OPENAI_API_KEY" "${OPENAI_API_KEY:-}"
  merge_env_key "OPENAI_BASE_URL" "${OPENAI_BASE_URL:-}"
  merge_env_key "SUPER_ADMIN_SECRET" "${SUPER_ADMIN_SECRET:-}"

  npm_install_deps

  prisma_migrate_deploy 1
  run_app_shell_as_user "npx prisma generate"

  if [[ "$SKIP_PREFLIGHT" != "1" ]]; then
    log "qa:deploy-preflight …"
    run_app_shell_as_user "npm run qa:deploy-preflight" \
      || warn "预检未全过，请查看日志后决定是否继续"
  fi

  log "npm run build …"
  centos7_prepare_build
  local build_cmd
  build_cmd="$(centos7_build_cmd "npm run build")"
  run_app_shell_as_user "$build_cmd"

  mkdir -p "$OPERONE_DIR/public/covers" "$OPERONE_DIR/public/comic-panels" "$OPERONE_DIR/public/game-bg"
  chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"

  if [[ "$SKIP_SEED" != "1" ]]; then
    log "seed:samples（样品馆）…"
    run_app_shell_as_user "npm run seed:samples" \
      || warn "seed 失败（可稍后手动 npm run seed:samples）"
  fi

  log "app 阶段完成 → $OPERONE_DIR"
  install_godot_production || true
}

install_systemd_unit() {
  need_root
  log "[3/5] 启动服务 …"
  local unit="/etc/systemd/system/operone.service"
  local npm_bin node_bin
  npm_bin="$(run_app_shell_as_user 'command -v npm' 2>/dev/null || command -v npm)"
  node_bin="$(run_app_shell_as_user 'command -v node' 2>/dev/null || command -v node)"
  [[ -n "$npm_bin" ]] || die "未找到 npm"
  [[ -n "$node_bin" ]] || die "未找到 node"

  local extra_env=""
  if is_centos7; then
    local ld_ds
    ld_ds="$(centos7_libstdcxx_ld_path)"
    [[ -n "$ld_ds" ]] && extra_env="Environment=LD_LIBRARY_PATH=${ld_ds}
"
  fi
  local godot_env
  godot_env="$(godot_systemd_env_block)"
  [[ -n "$godot_env" ]] && extra_env="${extra_env}${godot_env}
"

  # 用 node 直接跑 run-start.mjs，避免 systemd 下 npm/npx/shell 问题
  cat > "$unit" <<EOF
[Unit]
Description=Operone 创作平台
Documentation=file://${OPERONE_DIR}/README.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${OPERONE_USER}
Group=${OPERONE_USER}
WorkingDirectory=${OPERONE_DIR}
EnvironmentFile=-${OPERONE_DIR}/.env
Environment=NODE_ENV=production
Environment=HOME=${OPERONE_DIR}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
${extra_env}ExecStart=${node_bin} ${OPERONE_DIR}/scripts/run-start.mjs
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

  chown -R "$OPERONE_USER:$OPERONE_USER" "$OPERONE_DIR"

  systemctl daemon-reload
  systemctl enable operone
  systemctl restart operone
  sleep 3

  if systemctl is-active --quiet operone; then
    ok "operone.service 已启动"
  else
    systemctl status operone --no-pager || true
    echo ""
    journalctl -u operone -n 50 --no-pager || true
    die "operone 启动失败（见上方 journal）"
  fi

  wait_for_health 30 || true
}

ensure_nginx_installed() {
  if command -v nginx >/dev/null 2>&1; then
    log "Nginx 已安装: $(nginx -v 2>&1)"
    return 0
  fi
  log "安装 Nginx …"
  install_nginx_pkg
}

phase_nginx() {
  need_root
  log "[4/5] 配置 Nginx …"
  [[ -n "$OPERONE_DOMAIN" ]] || die "请设置 OPERONE_DOMAIN=app.example.com"

  local template="$SCRIPT_DIR/templates/nginx-operone.conf"
  [[ -f "$template" ]] || die "缺少 Nginx 模板: $template（请使用完整仓库，勿只复制单个 .sh）"

  ensure_nginx_installed
  centos7_configure_selinux
  systemctl enable nginx 2>/dev/null || true

  nginx_write_operone_site "$template" "$OPERONE_DOMAIN" "$OPERONE_PORT"
  if [[ "$OS_FAMILY" == debian && -f /etc/nginx/sites-enabled/default ]]; then
    warn "移除 Nginx default 站点（避免与 operone 冲突）"
    rm -f /etc/nginx/sites-enabled/default
  fi

  nginx -t
  systemctl reload nginx || systemctl start nginx
  ok "Nginx 反代: http://${OPERONE_DOMAIN} → 127.0.0.1:${OPERONE_PORT}"
}

check_domain_points_here() {
  local domain="$1"
  local my_ip resolved
  my_ip="$(curl -4 -sf --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
  resolved="$(dig +short "$domain" A 2>/dev/null | tail -1)"
  if [[ -z "$resolved" ]]; then
    warn "DNS 未解析 $domain，HTTPS 可能失败"
    return 1
  fi
  if [[ -n "$my_ip" && "$resolved" != "$my_ip" ]]; then
    warn "DNS $domain → $resolved，本机公网 IP ≈ $my_ip（不一致时 Certbot 会失败）"
    return 1
  fi
  ok "DNS 检查: $domain → $resolved"
  return 0
}

phase_ssl() {
  need_root
  log "[5/5] 申请 HTTPS …"
  [[ -n "$OPERONE_DOMAIN" ]] || die "请设置 OPERONE_DOMAIN"
  [[ -n "$CERTBOT_EMAIL" ]] || die "请设置 CERTBOT_EMAIL"

  check_domain_points_here "$OPERONE_DOMAIN" || true

  install_certbot_pkgs
  certbot --nginx -d "$OPERONE_DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect
  ok "HTTPS: https://${OPERONE_DOMAIN}"
}

configure_firewall_if_needed() {
  need_root
  local with_http=0
  [[ -n "${OPERONE_DOMAIN:-}" ]] && with_http=1
  if configure_firewall_ports "$OPERONE_PORT" "$with_http"; then
    ok "防火墙规则已更新"
  else
    if [[ "$OS_FAMILY" == debian ]]; then
      pkg_install ufw 2>/dev/null && configure_firewall_ports "$OPERONE_PORT" "$with_http" || warn "未配置防火墙，请手动放行 ${OPERONE_PORT}/tcp"
    else
      warn "未检测到 ufw/firewalld，请手动放行 ${OPERONE_PORT}/tcp"
    fi
  fi
}

server_primary_ip() {
  hostname -I 2>/dev/null | awk '{print $1}'
}

print_deploy_summary() {
  local ip access_url env_file="$OPERONE_DIR/.env"
  ip="$(server_primary_ip)"

  if [[ -n "$OPERONE_DOMAIN" ]]; then
    if [[ -n "$CERTBOT_EMAIL" ]]; then
      access_url="https://${OPERONE_DOMAIN}"
    else
      access_url="http://${OPERONE_DOMAIN}"
    fi
  else
    access_url="http://${ip:-127.0.0.1}:${OPERONE_PORT}"
  fi

  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║          Operone 部署成功 — 可以访问了               ║"
  echo "╠══════════════════════════════════════════════════════╣"
  printf "║  访问地址:  %-40s ║\n" "$access_url"
  printf "║  健康检查:  %-40s ║\n" "curl -s http://127.0.0.1:${OPERONE_PORT}/api/health"
  echo "╠══════════════════════════════════════════════════════╣"
  echo "║  下一步（可选）：编辑 API Key 后重启                  ║"
  printf "║    nano %s\n" "$env_file"
  echo "║    systemctl restart operone"
  echo "╠══════════════════════════════════════════════════════╣"
  echo "║  再次执行 install.sh = 自动更新版本                  ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
}
