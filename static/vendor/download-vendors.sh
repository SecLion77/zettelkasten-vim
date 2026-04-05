#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# download-vendors.sh
# Eenmalig uitvoeren met internetverbinding om alle CDN-afhankelijkheden
# lokaal op te slaan. Daarna werkt de app volledig offline.
#
# Gebruik:
#   cd static/vendor
#   bash download-vendors.sh
#
# Offline AI:
#   De app werkt offline met een lokaal Ollama-model (http://localhost:11434).
#   Online modellen (Anthropic, OpenAI, Google, Mistral, OpenRouter) vereisen
#   een internetverbinding en worden automatisch overgeslagen als die ontbreekt.
#
# Spellchecker:
#   Voor spellingcontrole offline zijn woordenboekbestanden nodig.
#   Voer daarna ook uit:  bash download-dictionaries.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦 Zettelkasten vendor-download"
echo "================================"

download() {
  local url="$1"
  local out="$2"
  echo -n "  ⬇  $out ... "
  curl -fsSL --max-time 30 "$url" -o "$out"
  local size=$(wc -c < "$out" | tr -d ' ')
  echo "✓ (${size} bytes)"
}

# ── React 18 ──────────────────────────────────────────────────────────────────
download "https://unpkg.com/react@18/umd/react.production.min.js" \
         "react.production.min.js"

download "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" \
         "react-dom.production.min.js"

# ── PDF.js 3.11.174 ───────────────────────────────────────────────────────────
download "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" \
         "pdf.min.js"

download "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js" \
         "pdf.worker.min.js"

# ── Hack font (CSS + woff2) ───────────────────────────────────────────────────
download "https://cdn.jsdelivr.net/npm/hack-font@3/build/web/hack.css" \
         "hack.css"

mkdir -p fonts
for variant in regular bold italic bolditalic; do
  download "https://cdn.jsdelivr.net/npm/hack-font@3/build/web/fonts/hack-${variant}-subset.woff2" \
           "fonts/hack-${variant}-subset.woff2" 2>/dev/null || \
  echo "    ⚠ hack-${variant}-subset.woff2 niet gevonden, overgeslagen"
done

# ── DM Sans via Google Fonts ──────────────────────────────────────────────────
# Google Fonts vereist internet; voor offline wordt DM Sans ingebed als woff2.
echo -n "  ⬇  dm-sans.css (Google Fonts) ... "
curl -fsSL --max-time 15 \
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap" \
  -A "Mozilla/5.0" \
  -o "dm-sans-urls.css" 2>/dev/null && {

  mkdir -p fonts
  grep -oP "https://[^)']+" dm-sans-urls.css | sort -u | while read url; do
    fname="fonts/$(echo "$url" | md5sum | cut -c1-8).woff2"
    curl -fsSL --max-time 15 "$url" -o "$fname" 2>/dev/null || true
    sed -i "s|$url|$fname|g" dm-sans-urls.css
  done
  mv dm-sans-urls.css dm-sans.css
  echo "✓"
} || {
  echo "/* DM Sans niet beschikbaar, systeemfont wordt gebruikt */" > dm-sans.css
  echo "⚠ overgeslagen (geen internet?), systeemfont als fallback"
}

# ── Pas hack.css aan zodat het naar lokale fonts/ map verwijst ────────────────
sed -i 's|../fonts/|fonts/|g' hack.css 2>/dev/null || true

# ── Woordenboeken voor spellingcontrole (optioneel) ───────────────────────────
if [ -f "download-dictionaries.sh" ]; then
  echo ""
  echo "📖 Woordenboeken downloaden..."
  bash download-dictionaries.sh
else
  echo ""
  echo "  ℹ  Tip: voer ook 'bash download-dictionaries.sh' uit voor offline spellingcontrole"
  echo "     (nl_NL en en_US woordenboeken in static/vendor/dict/)"
fi

echo ""
echo "✅ Klaar! Alle vendor-bestanden lokaal opgeslagen."
echo ""
echo "   Start offline met:  python3 server.py --offline"
echo "   Start online met:   python3 server.py"
echo ""
echo "   Offline AI: zorg dat Ollama draait op http://localhost:11434"
echo "   Online AI:  stel API-sleutels in via ⚙ Instellingen → API-sleutels"
