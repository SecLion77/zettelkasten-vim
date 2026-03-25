#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# download-dictionaries.sh
# Downloadt Hunspell-woordenboeken voor Nederlands (NL) en Engels (EN)
# en plaatst ze in static/vendor/dict/ zodat de app volledig offline werkt.
#
# Bronnen:
#   NL — OpenTaal 2.20G (officieel, ~400k woorden)
#   EN — SCOWL en_US large (~200k woorden)
#
# Gebruik:
#   cd static/vendor
#   bash download-dictionaries.sh
#
# Daarna herstart server.py — geen andere aanpassingen nodig.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DICT_DIR="$SCRIPT_DIR/dict"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "  ${RED}✗${NC} $*"; }
info() { echo -e "  ${BLUE}→${NC} $*"; }

echo ""
echo "📚 Zettelkasten — woordenboek download"
echo "======================================="
echo ""

mkdir -p "$DICT_DIR"

# ── Hulpfunctie: download met voortgangsindicator ────────────────────────────
download() {
  local url="$1"
  local out="$2"
  local label="$3"
  echo -n "  ⬇  $label ... "
  if curl -fsSL --max-time 60 --retry 2 "$url" -o "$out" 2>/dev/null; then
    local size
    size=$(wc -c < "$out" | tr -d ' ')
    echo -e "${GREEN}✓${NC} ($(numfmt --to=iec-i --suffix=B "$size" 2>/dev/null || echo "${size} bytes"))"
    return 0
  else
    echo -e "${RED}mislukt${NC}"
    return 1
  fi
}

# ── Hulpfunctie: woorden tellen in .dic bestand ──────────────────────────────
count_words() {
  local dic="$1"
  # Eerste regel is het aantal, sla die over; tel overige niet-lege regels
  tail -n +2 "$dic" 2>/dev/null | grep -c '.' || echo "?"
}

# ─────────────────────────────────────────────────────────────────────────────
# NEDERLANDS — OpenTaal 2.20G
# Officieel woordenboek van de Nederlandse Taalunie
# ─────────────────────────────────────────────────────────────────────────────
echo "🇳🇱  Nederlands (OpenTaal 2.20G)"
echo "-----------------------------------"

NL_DIC="$DICT_DIR/nl_NL.dic"
NL_AFF="$DICT_DIR/nl_NL.aff"
NL_ZIP="$TMP_DIR/opentaal-nl.zip"

# OpenTaal GitHub release
NL_ZIP_URL="https://github.com/OpenTaal/opentaal-hunspell/archive/refs/heads/master.zip"

# Alternatief: directe bestanden
NL_DIC_URL="https://raw.githubusercontent.com/OpenTaal/opentaal-hunspell/master/nl.dic"
NL_AFF_URL="https://raw.githubusercontent.com/OpenTaal/opentaal-hunspell/master/nl.aff"

nl_ok=false

# Probeer eerst directe bestanden (sneller)
if download "$NL_DIC_URL" "$TMP_DIR/nl.dic" "nl_NL.dic (OpenTaal)"; then
  if download "$NL_AFF_URL" "$TMP_DIR/nl.aff" "nl_NL.aff (OpenTaal)"; then
    cp "$TMP_DIR/nl.dic" "$NL_DIC"
    cp "$TMP_DIR/nl.aff" "$NL_AFF"
    nl_ok=true
  fi
fi

# Fallback: download zip en pak uit
if [ "$nl_ok" = false ]; then
  warn "Directe download mislukt, probeer zip..."
  if download "$NL_ZIP_URL" "$NL_ZIP" "opentaal-hunspell.zip"; then
    cd "$TMP_DIR"
    unzip -q "$NL_ZIP" 2>/dev/null || true
    # Zoek .dic en .aff in uitgepakte map
    NL_DIC_FOUND=$(find "$TMP_DIR" -name "nl.dic" -o -name "nl_NL.dic" 2>/dev/null | head -1)
    NL_AFF_FOUND=$(find "$TMP_DIR" -name "nl.aff" -o -name "nl_NL.aff" 2>/dev/null | head -1)
    if [ -n "$NL_DIC_FOUND" ] && [ -n "$NL_AFF_FOUND" ]; then
      cp "$NL_DIC_FOUND" "$NL_DIC"
      cp "$NL_AFF_FOUND" "$NL_AFF"
      nl_ok=true
    fi
    cd "$SCRIPT_DIR"
  fi
fi

if [ "$nl_ok" = true ]; then
  # Hernoem nl.dic → nl_NL.dic als nodig (voor consistentie)
  WORDS=$(count_words "$NL_DIC")
  ok "nl_NL.dic — $WORDS basisvormen"
  ok "nl_NL.aff — affix-regels (morfologie)"
else
  err "Nederlands woordenboek kon niet worden gedownload"
  err "Handmatig: download nl.dic + nl.aff van https://github.com/OpenTaal/opentaal-hunspell"
  err "en zet ze als nl_NL.dic / nl_NL.aff in static/vendor/dict/"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# ENGELS — SCOWL en_US (large)
# Standaard Unix/Linux Hunspell woordenboek
# ─────────────────────────────────────────────────────────────────────────────
echo "🇺🇸  Engels (SCOWL en_US large)"
echo "---------------------------------"

EN_DIC="$DICT_DIR/en_US.dic"
EN_AFF="$DICT_DIR/en_US.aff"

# LibreOffice dict-en (meest compleet, ~600k woorden)
EN_DIC_URL="https://raw.githubusercontent.com/LibreOffice/dictionaries/master/en/en_US.dic"
EN_AFF_URL="https://raw.githubusercontent.com/LibreOffice/dictionaries/master/en/en_US.aff"

en_ok=false

if download "$EN_DIC_URL" "$EN_DIC" "en_US.dic (LibreOffice/SCOWL)"; then
  if download "$EN_AFF_URL" "$EN_AFF" "en_US.aff (LibreOffice/SCOWL)"; then
    en_ok=true
  fi
fi

if [ "$en_ok" = true ]; then
  WORDS=$(count_words "$EN_DIC")
  ok "en_US.dic — $WORDS basisvormen"
  ok "en_US.aff — affix-regels (morfologie)"
else
  err "Engels woordenboek kon niet worden gedownload"
  err "Handmatig: download en_US.dic + en_US.aff van"
  err "https://github.com/LibreOffice/dictionaries/tree/master/en"
  err "en zet ze in static/vendor/dict/"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Controleer resultaat
# ─────────────────────────────────────────────────────────────────────────────
echo "📂 Woordenboeken opgeslagen in:"
echo "   $DICT_DIR/"
echo ""

ls -lh "$DICT_DIR/" 2>/dev/null | grep -v "^total" | while read -r line; do
  echo "   $line"
done

echo ""
echo "─────────────────────────────────────────"

any_missing=false
for f in nl_NL.dic nl_NL.aff en_US.dic en_US.aff; do
  if [ ! -f "$DICT_DIR/$f" ]; then
    warn "Ontbreekt: dict/$f"
    any_missing=true
  fi
done

if [ "$any_missing" = false ]; then
  echo -e "${GREEN}✅ Alle woordenboeken aanwezig!${NC}"
  echo ""
  echo "   Herstart server.py om de nieuwe woordenboeken te laden:"
  echo "   python3 server.py"
  echo ""
  echo "   De server detecteert static/vendor/dict/ automatisch."
  echo "   Geen extra configuratie nodig."
else
  echo ""
  warn "Sommige bestanden ontbreken — zie instructies hierboven."
fi

echo ""
