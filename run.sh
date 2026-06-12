#!/bin/bash
set -e
cd /workspaces/Appsport 2>/dev/null || cd "$(dirname "$0")"
echo "==> Mise à jour du code..."
git fetch origin claude/funny-hypatia-r9bccd
git checkout claude/funny-hypatia-r9bccd
git pull origin claude/funny-hypatia-r9bccd
echo "==> Installation des dépendances..."
rm -rf node_modules package-lock.json
npm install
echo "==> Démarrage de l'app..."
npx expo start --tunnel
