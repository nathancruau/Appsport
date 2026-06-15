#!/bin/bash
cd /workspaces/Appsport 2>/dev/null || cd "$(dirname "$0")"
git fetch origin claude/funny-hypatia-r9bccd 2>/dev/null || true
git checkout claude/funny-hypatia-r9bccd 2>/dev/null || true
git pull origin claude/funny-hypatia-r9bccd 2>/dev/null || true
exec bash "$(cd "$(dirname "$0")" && pwd)/start.sh"
