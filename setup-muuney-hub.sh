#!/bin/bash
# Script para extrair o projeto muuney-hub no Desktop
# Gerado automaticamente — execute com: bash ~/Desktop/setup-muuney-hub.sh

set -e

DESKTOP="$HOME/Desktop"
HUB_DIR="$DESKTOP/muuney-hub"
LANDING_DIR=$(find "$DESKTOP" "$HOME/Documents" "$HOME" -maxdepth 3 -name "muuney-landing-main" -type d 2>/dev/null | head -1)

if [ -z "$LANDING_DIR" ]; then
  echo "❌ Pasta muuney-landing-main não encontrada. Localize manualmente:"
  echo "   find ~ -name 'muuney-landing-main' -type d 2>/dev/null"
  exit 1
fi

TAR_FILE="$LANDING_DIR/muuney-hub.tar.gz"

if [ ! -f "$TAR_FILE" ]; then
  echo "❌ Arquivo muuney-hub.tar.gz não encontrado em $LANDING_DIR"
  exit 1
fi

echo "📦 Extraindo muuney-hub para $HUB_DIR..."
mkdir -p "$HUB_DIR"
tar xzf "$TAR_FILE" -C "$HUB_DIR"

echo "📥 Instalando dependências..."
cd "$HUB_DIR"
npm install

echo "🧹 Limpando tar.gz do muuney-landing..."
rm -f "$TAR_FILE"

echo ""
echo "✅ muuney-hub extraído em: $HUB_DIR"
echo ""
echo "Próximos passos:"
echo "  1. cd $HUB_DIR"
echo "  2. Copie seu .env (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY)"
echo "  3. npm run dev  → http://localhost:3001"
echo "  4. git init && git remote add origin git@github.com:lucaslpof/muuney-hub.git"
echo "  5. Crie o projeto Vercel para hub.muuney.com.br"
