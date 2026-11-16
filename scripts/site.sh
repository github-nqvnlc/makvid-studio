#!/usr/bin/env bash
# Site operations from the repo root (Linux server, macOS, or Git Bash/WSL on Windows):
#   ./manage.sh help
# Needs: git, docker (compose v2), a filled .env. Uses compose.tunnel.yaml automatically when TUNNEL_TOKEN is set.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$PWD"
BRANCH_DEFAULT="main"
LOCK="$ROOT/.site-update.lock"

c_red=$'\e[31m'; c_grn=$'\e[32m'; c_ylw=$'\e[33m'; c_off=$'\e[0m'
say() { printf '%s==>%s %s\n' "$c_grn" "$c_off" "$*"; }
warn() { printf '%s!!%s  %s\n' "$c_ylw" "$c_off" "$*" >&2; }
die() { printf '%sERROR%s %s\n' "$c_red" "$c_off" "$*" >&2; exit 1; }

[ -f .env ] || die ".env not found. Run: cp .env.example .env  and fill in the required values."
command -v docker >/dev/null || die "docker is not installed or not in PATH."
docker info >/dev/null 2>&1 || die "The Docker daemon is not running. Start Docker first."

# Read one value from .env without sourcing it (values may contain odd characters).
env_get() { { grep -E "^$1=" .env || true; } | tail -n1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }

COMPOSE_FILE_NAME="compose.yaml"
[ -n "$(env_get TUNNEL_TOKEN)" ] && COMPOSE_FILE_NAME="compose.tunnel.yaml"
dc() { docker compose -f "$COMPOSE_FILE_NAME" "$@"; }

current_branch() { git rev-parse --abbrev-ref HEAD; }
web_url() { env_get APP_URL | sed 's#/*$##'; }

usage() {
  cat <<EOF
Usage: ./manage.sh              (no arguments: interactive menu)
       ./manage.sh <command> [args]

Deploy
  update             git pull when possible, then always rebuild and restart with the code on disk
  build [svc...]     Build images (all, or the named services)
  start              Start the site (builds missing images, runs migrations first)
  stop               Stop the site (data volumes are kept)
  restart [svc...]   Restart everything, or only the named services
  down               Stop and remove containers (volumes kept)
  rollback <commit>  Check out a commit or tag, rebuild and restart

Inspect
  status             Containers, health and the site URL check
  health             Call /api/health through the local port
  logs [svc] [N]     Follow logs (default: all services, last 100 lines). e.g. logs worker-ai 300
  errors [svc]       Last 300 log lines filtered for errors
  version            Deployed commit and when the images were built
  disk               Docker disk usage and the backups folder size

Data
  migrate            Apply database migrations
  backup             Run a database backup now (also runs daily on its own)
  backup-test        Restore the newest backup into a scratch database to prove it works
  psql               Open a SQL shell in the database
  admin <email>      Make a user a platform admin

Maintenance
  shell <svc>        Open a shell inside a running service (default: web)
  ps                 docker compose ps
  prune              Remove dangling images and build cache (safe; volumes are never touched)
  config             Check the compose file and .env are valid

Compose file in use: $COMPOSE_FILE_NAME
EOF
}

wait_healthy() {
  local timeout="${1:-240}" waited=0
  say "Waiting for the web service to become healthy (up to ${timeout}s)..."
  while [ "$waited" -lt "$timeout" ]; do
    local st
    st="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$(dc ps -q web 2>/dev/null | head -n1)" 2>/dev/null || echo none)"
    case "$st" in
      healthy) say "web is healthy."; return 0 ;;
      unhealthy) warn "web is unhealthy. Check: ./manage.sh logs web"; return 1 ;;
    esac
    sleep 3; waited=$((waited + 3))
  done
  warn "Timed out waiting for web. Check: ./manage.sh logs web"
  return 1
}

cmd_start() {
  say "Starting the site ($COMPOSE_FILE_NAME)..."
  dc up -d --build
  wait_healthy
  cmd_status
}

cmd_stop() { say "Stopping the site (volumes are kept)..."; dc stop; }
cmd_down() { say "Removing containers (volumes are kept)..."; dc down; }

cmd_restart() {
  if [ "$#" -gt 0 ]; then dc restart "$@"; else dc restart; fi
  wait_healthy
}

cmd_build() { say "Building images..."; dc build "$@"; }

cmd_update() {
  # One update at a time (a cron job and a person must not collide).
  if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
    die "Another update is running (pid $(cat "$LOCK"))."
  fi
  echo $$ >"$LOCK"; trap 'rm -f "$LOCK"' EXIT

  local branch before after
  branch="$(current_branch)"
  before="$(git rev-parse HEAD)"

  # Pull when possible. Whatever happens, the build below uses the code that is on disk now.
  if [ "$branch" = "HEAD" ]; then
    warn "Detached HEAD: not pulling. Building the code as it is."
  elif [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    warn "Local changes in tracked files: not pulling. Building the code as it is."
  elif ! git fetch --prune origin "$branch" 2>/dev/null; then
    warn "Cannot reach origin: not pulling. Building the code as it is."
  elif ! git merge --ff-only "origin/$branch" >/dev/null 2>&1; then
    warn "Local commits diverge from origin/$branch: not pulling. Building the code as it is."
  fi
  after="$(git rev-parse HEAD)"

  if [ "$before" != "$after" ]; then
    say "New code: $(git rev-parse --short "$before")..$(git rev-parse --short "$after")"
    git --no-pager log --oneline "$before..$after" | head -20
    git diff --quiet "$before" "$after" -- .env.example || warn ".env.example changed: compare it with your .env for new variables."
  else
    say "No new commits. Rebuilding with the current code ($(git rev-parse --short HEAD))."
  fi

  say "Rebuilding images and restarting (migrations run before the web starts)..."
  dc up -d --build --remove-orphans
  wait_healthy || die "The new version did not become healthy. Roll back with: ./manage.sh rollback $(git rev-parse --short "$before")"
  docker image prune -f >/dev/null
  say "Updated to $(git rev-parse --short HEAD)."
}

cmd_rollback() {
  [ -n "${1:-}" ] || die "Give a commit or tag: ./manage.sh rollback <commit>"
  git rev-parse --verify "$1^{commit}" >/dev/null 2>&1 || die "Unknown commit: $1"
  warn "Rolling code back to $1. Database migrations are NOT undone: only roll back across versions with compatible schemas."
  read -r -p "Continue? [y/N] " a; [ "$a" = "y" ] || exit 0
  git checkout --quiet "$1"
  dc up -d --build --remove-orphans
  wait_healthy
  warn "You are on a detached commit. To return to normal updates: git checkout $BRANCH_DEFAULT"
}

cmd_status() {
  dc ps
  local url; url="$(web_url)"
  [ -n "$url" ] && { printf 'Site URL (APP_URL): %s\n' "$url"; }
  cmd_health || true
}

cmd_health() {
  local port; port="$(env_get WEB_PORT)"; port="${port:-3000}"
  if curl -fsS -m 5 "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
    say "Local health check OK (127.0.0.1:$port)."
  else
    warn "Local health check FAILED (127.0.0.1:$port)."; return 1
  fi
  local url; url="$(web_url)"
  case "$url" in
    https://*) if curl -fsS -m 8 "$url/api/health" >/dev/null 2>&1; then say "Public check OK ($url)."; else warn "Public check FAILED ($url): tunnel or DNS problem?"; return 1; fi ;;
  esac
}

cmd_logs() {
  local svc="${1:-}" n="${2:-100}"
  if [ -n "$svc" ] && [[ "$svc" =~ ^[0-9]+$ ]]; then n="$svc"; svc=""; fi
  if [ -n "$svc" ]; then dc logs -f --tail "$n" "$svc"; else dc logs -f --tail "$n"; fi
}

cmd_errors() {
  dc logs --no-color --tail 300 ${1:+"$1"} 2>&1 | grep -iE "error|fail|exception|fatal|unhealthy|ECONN|timeout" | tail -n 80 || say "No error lines in the last 300 log lines."
}

cmd_version() {
  say "Commit: $(git --no-pager log -1 --format='%h %s (%cd)' --date=short)  branch: $(current_branch)"
  docker image ls --format '{{.Repository}}:{{.Tag}}  built {{.CreatedSince}}' | grep -E "makvid" || true
}

cmd_disk() { docker system df; du -sh "${BACKUP_DIR:-backups}" 2>/dev/null || true; }

cmd_migrate() { say "Applying migrations..."; dc run --rm migrate; }

cmd_backup() {
  say "Running a backup now..."
  dc exec -T backup /backup/backup.sh
  ls -lh "$(env_get BACKUP_DIR | grep . || echo backups)" 2>/dev/null | tail -5 || true
}

cmd_backup_test() { dc run --rm backup /backup/restore-test.sh; }

cmd_psql() {
  dc exec postgres psql -U "$(env_get POSTGRES_USER | grep . || echo makvid)" -d "$(env_get POSTGRES_DB | grep . || echo makvid)"
}

sql() { dc exec -T postgres psql -v ON_ERROR_STOP=1 -U "$(env_get POSTGRES_USER | grep . || echo makvid)" -d "$(env_get POSTGRES_DB | grep . || echo makvid)" "$@"; }

cmd_admin() {
  local email="${1:-}"; [[ "$email" =~ ^[^[:space:]\'\"\;\\]+@[^[:space:]\'\"\;\\]+$ ]] || die "Give a valid email: ./manage.sh admin <email>"
  sql -c "UPDATE users SET is_platform_admin = true WHERE email = '$email';"
}

cmd_shell() { dc exec "${1:-web}" sh; }
cmd_prune() { say "Removing dangling images and build cache..."; docker image prune -f; docker builder prune -f; }
cmd_config() { dc config -q && say "Compose file and .env are valid."; }

# ---- interactive menu (./manage.sh with no arguments) ----------------------------------------------------------
pick_service() {
  local prompt="${1:-Service}" i=1 s choice
  local -a svcs=()
  while IFS= read -r s; do svcs+=("$s"); done < <(dc config --services | sort)
  echo "  0) All services"
  for s in "${svcs[@]}"; do printf '  %d) %s\n' "$i" "$s"; i=$((i + 1)); done
  read -r -p "$prompt [0]: " choice
  choice="${choice:-0}"
  if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#svcs[@]}" ]; then
    PICKED="${svcs[$((choice - 1))]}"
  else
    PICKED=""
  fi
}

# Run an action in a subshell so Ctrl+C stops it (e.g. live logs) and returns to the menu instead of quitting.
run_action() { ( "$@" ) || true; }
confirm() { local a; read -r -p "$1 [y/N] " a; [ "$a" = "y" ] || [ "$a" = "Y" ]; }

menu() {
  [ -t 0 ] || die "The menu needs a terminal. Use: ./manage.sh help"
  trap ':' INT
  local choice
  while true; do
    clear 2>/dev/null || true
    local state; state="$(dc ps --status running -q 2>/dev/null | wc -l | tr -d ' ')"
    printf '%sMakVid Studio%s   %s   running containers: %s   (%s)\n' "$c_grn" "$c_off" "$(git rev-parse --short HEAD 2>/dev/null)" "$state" "$COMPOSE_FILE_NAME"
    cat <<'EOF'

  LOGS
   1) Live logs, all services
   2) Live logs, one service
   3) Errors in recent logs

  SITE
   4) Status and health check
   5) Update: pull (if any) and rebuild with current code
   6) Start site
   7) Stop site
   8) Restart (all or one service)

  DATA
   9) Back up the database now
  10) Make a user a platform admin
  11) Database shell (psql)

  OTHER
  12) Disk usage and cleanup
  13) Service shell
   h) Command list     q) Quit
EOF
    read -r -p $'\nChoose: ' choice || exit 0
    case "$choice" in
      1) echo "Live logs (Ctrl+C returns to the menu)"; run_action dc logs -f --tail 100 ;;
      2) pick_service "Service"; echo "Live logs (Ctrl+C returns to the menu)"
         if [ -n "$PICKED" ]; then run_action dc logs -f --tail 200 "$PICKED"; else run_action dc logs -f --tail 100; fi ;;
      3) pick_service "Service"; run_action cmd_errors "$PICKED" ;;
      4) run_action cmd_status ;;
      5) confirm "Pull new code (if any), rebuild and restart?" && run_action cmd_update ;;
      6) run_action cmd_start ;;
      7) confirm "Stop the whole site?" && run_action cmd_stop ;;
      8) pick_service "Service to restart"; confirm "Restart ${PICKED:-everything}?" && run_action cmd_restart ${PICKED:+"$PICKED"} ;;
      9) run_action cmd_backup ;;
      10) read -r -p "User email: " e; run_action cmd_admin "$e" ;;
      11) run_action cmd_psql ;;
      12) run_action cmd_disk; confirm "Remove dangling images and build cache?" && run_action cmd_prune ;;
      13) pick_service "Service (default web)"; run_action cmd_shell "${PICKED:-web}" ;;
      h|H) usage ;;
      q|Q|0) exit 0 ;;
      *) warn "Unknown choice: $choice" ;;
    esac
    echo
    read -r -p "Press Enter to return to the menu..." _ || exit 0
  done
}

command="${1:-menu}"; shift || true
case "$command" in
  update) cmd_update "$@" ;;
  build) cmd_build "$@" ;;
  start|up) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_restart "$@" ;;
  down) cmd_down ;;
  rollback) cmd_rollback "$@" ;;
  status|st) cmd_status ;;
  health) cmd_health ;;
  logs|log) cmd_logs "$@" ;;
  errors) cmd_errors "$@" ;;
  version) cmd_version ;;
  disk) cmd_disk ;;
  migrate) cmd_migrate ;;
  backup) cmd_backup ;;
  backup-test) cmd_backup_test ;;
  psql) cmd_psql ;;
  admin) cmd_admin "$@" ;;
  shell|sh) cmd_shell "$@" ;;
  ps) dc ps ;;
  prune) cmd_prune ;;
  config) cmd_config ;;
  menu) menu ;;
  help|-h|--help) usage ;;
  *) usage; die "Unknown command: $command" ;;
esac
