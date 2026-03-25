#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# download-vendors.sh
# Eenmalig uitvoeren met internetverbinding om alle CDN-afhankelijkheden
# lokaal op te slaan. Daarna werkt de app volledig offline.
#
# Gebruik:
#   cd static/vendor
#   bash download-vendors.sh
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

# React 18
download "https://unpkg.com/react@18/umd/react.production.min.js" \
         "react.production.min.js"

download "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" \
         "react-dom.production.min.js"

# PDF.js 3.11.174
download "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" \
         "pdf.min.js"

download "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js" \
         "pdf.worker.min.js"

# Hack font (CSS + woff2)
download "https://cdn.jsdelivr.net/npm/hack-font@3/build/web/hack.css" \
         "hack.css"

# Hack font bestanden die hack.css naar verwijst
mkdir -p fonts
for variant in Regular Bold Italic BoldItalic; do
  download "https://cdn.jsdelivr.net/npm/hack-font@3/build/web/fonts/hack-${variant,,}-subset.woff2" \
           "fonts/hack-${variant,,}-subset.woff2" 2>/dev/null || \
  echo "    ⚠ hack-${variant,,}-subset.woff2 niet gevonden, overgeslagen"
done

# DM Sans font via Google Fonts — download als inlined CSS met embedded base64
# (Google Fonts vereist internet; voor offline: systeemfont als fallback)
echo -n "  ⬇  dm-sans.css (Google Fonts) ... "
curl -fsSL --max-time 15 \
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap" \
  -A "Mozilla/5.0" \
  -o "dm-sans-urls.css" 2>/dev/null && {

  # Download de woff2 bestanden waarnaar dm-sans-urls.css verwijst
  mkdir -p fonts
  grep -oP "https://[^)']+" dm-sans-urls.css | sort -u | while read url; do
    fname="fonts/$(echo "$url" | md5sum | cut -c1-8).woff2"
    curl -fsSL --max-time 15 "$url" -o "$fname" 2>/dev/null || true
    # Vervang URL door relatief pad in CSS
    sed -i "s|$url|$fname|g" dm-sans-urls.css
  done
  mv dm-sans-urls.css dm-sans.css
  echo "✓"
} || {
  # Fallback: lege CSS (systeemfont wordt gebruikt via font-family fallback)
  echo "/* DM Sans niet beschikbaar, systeemfont wordt gebruikt */" > dm-sans.css
  echo "⚠ overgeslagen (geen internet?), systeemfont als fallback"
}

# Pas hack.css aan zodat het naar lokale fonts/ map verwijst
sed -i 's|../fonts/|fonts/|g' hack.css 2>/dev/null || true

echo ""
echo "✅ Klaar! Alle vendor-bestanden lokaal opgeslagen."
echo "   Start de server met: python3 server.py --offline"
