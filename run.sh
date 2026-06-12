#!/bin/bash
cd /workspaces/Appsport 2>/dev/null || cd "$(dirname "$0")"

echo ""
echo "===== MISE A JOUR DU CODE ====="
git fetch origin claude/funny-hypatia-r9bccd 2>/dev/null || true
git checkout claude/funny-hypatia-r9bccd 2>/dev/null || true
git pull origin claude/funny-hypatia-r9bccd || true

echo ""
echo "===== INSTALLATION (2-3 min) ====="
rm -rf node_modules
npm install --silent

echo ""
echo "===== DEMARRAGE ====="

# If running in GitHub Codespaces, use the built-in port forwarding
if [ -n "$CODESPACE_NAME" ]; then
  HOST="${CODESPACE_NAME}-8081.preview.app.github.dev"
  echo "Codespace détecté: $CODESPACE_NAME"
  echo "Démarrage sur: exp://$HOST"

  # Make port public via gh CLI if available
  gh codespace ports visibility 8081:public -c "$CODESPACE_NAME" 2>/dev/null || true

  REACT_NATIVE_PACKAGER_HOSTNAME="$HOST" npx expo start \
    --port 8081 \
    --host "$HOST" \
    2>&1
else
  # Fallback: try tunnel
  npm install -g @expo/ngrok@^4.1.0 --silent 2>/dev/null || true
  npx expo start --tunnel 2>&1
fi
