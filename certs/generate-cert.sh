#!/usr/bin/env bash
# ── Genereer een zelf-ondertekend HTTPS-certificaat voor lokaal gebruik ─────
# Nodig om de Zettelkasten-app via --https te draaien: Service Workers
# (offline/PWA) vereisen een "secure context", en dat is alleen https://
# of http://localhost — nooit een gewoon http:// naar een netwerk-IP zoals
# je iPad gebruikt om de laptop te bereiken.
#
# Gebruik:  cd certs && bash generate-cert.sh
#
# Genereert server.crt + server.key, geldig voor:
#   - localhost / 127.0.0.1  (voor gebruik op de laptop zelf)
#   - het huidige LAN-IP van deze machine (voor gebruik vanaf de iPad)
#
# Let op: als het LAN-IP van de laptop later verandert (bv. na een
# routerherstart, of een nieuwe DHCP-lease), moet dit script opnieuw
# gedraaid worden — het certificaat is alleen geldig voor het IP dat er
# nu in staat.

set -e
cd "$(dirname "$0")"

# ── Detecteer het huidige LAN-IP (macOS/Linux) ──────────────────────────────
LAN_IP=""
if command -v ipconfig >/dev/null 2>&1 && ipconfig getifaddr en0 >/dev/null 2>&1; then
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null)          # macOS, WiFi (en0)
elif command -v ipconfig >/dev/null 2>&1 && ipconfig getifaddr en1 >/dev/null 2>&1; then
  LAN_IP=$(ipconfig getifaddr en1 2>/dev/null)          # macOS, ethernet/tweede adapter
elif command -v hostname >/dev/null 2>&1; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')  # Linux
fi

if [ -z "$LAN_IP" ]; then
  echo "⚠ Kon het LAN-IP niet automatisch detecteren."
  read -p "Voer het IP-adres van deze laptop handmatig in (bv. 192.168.1.23): " LAN_IP
fi

if [ -z "$LAN_IP" ]; then
  echo "✗ Geen IP-adres opgegeven — afgebroken."
  exit 1
fi

echo "→ Certificaat wordt gemaakt voor: localhost, 127.0.0.1, en $LAN_IP"

# ── OpenSSL-configuratie met Subject Alternative Names ──────────────────────
# SAN is verplicht — moderne browsers (incl. Safari/iOS) negeren een
# certificaat dat het IP/hostname alleen in de "Common Name" heeft staan.
cat > _san.cnf << CNFEOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = Zettelkasten Lokale Server

[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ${LAN_IP}
CNFEOF

# ── Genereer sleutel + zelf-ondertekend certificaat ─────────────────────────
# 820 dagen geldig — de maximale looptijd die Apple sinds 2020 nog
# vertrouwt voor TLS-certificaten in Safari/iOS (langer wordt genegeerd).
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout server.key -out server.crt \
  -days 820 -config _san.cnf -extensions v3_req

rm -f _san.cnf

chmod 600 server.key
echo ""
echo "✓ Klaar — server.crt en server.key staan in $(pwd)"
echo ""
echo "Volgende stappen:"
echo "  1. Start de server met --https erbij, bv.:"
echo "       python3 ../server.py --host 0.0.0.0 --port 8888 --https"
echo "  2. Open op de iPad in Safari:  http://${LAN_IP}:<jouw-poort>/cert"
echo "     (downloadt het certificaat direct — zie README.md voor de vertrouw-stappen)"
echo "  3. Open op de iPad:  https://${LAN_IP}:<jouw-poort>"
echo ""
