#!/usr/bin/env bash
# Git Bash 入口：飞书授权 + TE 登录态
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python "$DIR/bootstrap_auth.py" "$@"
