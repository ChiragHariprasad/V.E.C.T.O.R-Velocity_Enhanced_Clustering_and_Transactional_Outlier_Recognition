#!/usr/bin/env bash
# Compatibility launcher. Installs nothing and does not stop existing services.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/start_demo.sh" "$@"
