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
  echo " Dans Expo Go > 'Enter URL manually' :"
  echo ""
  echo "   exp://$HOST"
  echo ""
  echo "================================================"
  echo ""

  REACT_NATIVE_PACKAGER_HOSTNAME="$HOST" npx expo start --port 8081
else
  npm install -g @expo/ngrok@^4.1.0 2>/dev/null || true
  npx expo start --tunnel
fi
