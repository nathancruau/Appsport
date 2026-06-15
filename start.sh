#!/bin/bash
cd /workspaces/Appsport 2>/dev/null || cd "$(dirname "$0")"

echo "===== INSTALLATION ====="
rm -rf node_modules
npm install

echo "===== MISE A JOUR AUTOMATIQUE ====="
# Background loop: pull every 30s, reinstall if package.json changed
(while true; do
  sleep 30
  OLD=$(git rev-parse HEAD 2>/dev/null)
  git pull origin claude/funny-hypatia-r9bccd --quiet 2>/dev/null || true
  NEW=$(git rev-parse HEAD 2>/dev/null)
  if [ "$OLD" != "$NEW" ]; then
    echo "[auto-update] Nouvelles modifications détectées"
    if git diff "$OLD" "$NEW" --name-only 2>/dev/null | grep -q "package.json"; then
      echo "[auto-update] package.json modifié, réinstallation..."
      npm install --quiet 2>/dev/null || true
    fi
  fi
done) &

echo "===== DEMARRAGE ====="

if [ -n "$CODESPACE_NAME" ]; then
  HOST="${CODESPACE_NAME}-8081.preview.app.github.dev"

  gh codespace ports visibility 8081:public 2>/dev/null || true

  echo ""
  echo "================================================"
  echo " Ouvre cette URL dans le navigateur du telephone :"
  echo ""
  echo "   https://$HOST"
  echo ""
  echo "================================================"
  echo ""
fi

npx expo start --web --port 8081
