#!/bin/bash
cd /workspaces/Appsport 2>/dev/null || cd "$(dirname "$0")"

echo "===== INSTALLATION ====="
rm -rf node_modules
npm install

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

  npx expo start --web --port 8081
else
  npx expo start --web --port 8081
fi
