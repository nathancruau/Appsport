#!/bin/bash
cd /workspaces/Appsport 2>/dev/null || cd "$(dirname "$0")"

echo "===== MISE A JOUR ====="
git fetch origin claude/funny-hypatia-r9bccd 2>/dev/null || true
git checkout claude/funny-hypatia-r9bccd 2>/dev/null || true
git pull origin claude/funny-hypatia-r9bccd || true

echo "===== INSTALLATION (2-3 min) ====="
rm -rf node_modules
npm install --silent

echo "===== DEMARRAGE ====="

if [ -n "$CODESPACE_NAME" ]; then
  HOST="${CODESPACE_NAME}-8081.preview.app.github.dev"

  # Make port 8081 publicly accessible
  gh codespace ports visibility 8081:public 2>/dev/null || true

  echo ""
  echo "================================================"
  echo " Ouvre Expo Go sur ton telephone"
  echo " Appuie sur 'Enter URL manually' et tape :"
  echo ""
  echo "   exp://$HOST"
  echo ""
  echo "================================================"
  echo ""

  REACT_NATIVE_PACKAGER_HOSTNAME="$HOST" npx expo start --port 8081
else
  npm install -g @expo/ngrok@^4.1.0 --silent 2>/dev/null || true
  npx expo start --tunnel
fi
