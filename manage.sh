#!/usr/bin/env bash
# Entry point from the repo root: ./manage.sh help
exec bash "$(dirname "${BASH_SOURCE[0]}")/scripts/site.sh" "$@"
