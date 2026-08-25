# HTTPS voor lokaal/offline gebruik op de iPad

## Waarom dit nodig is

Browsers staan Service Workers (nodig voor offline gebruik en de PWA)
alleen toe in een **"secure context"**: dat is `https://`, of de
uitzondering `http://localhost` op hetzelfde apparaat. Een gewoon
`http://`-adres naar het IP van je laptop — precies hoe de iPad de app nu
bereikt — telt daar niet in mee. Safari is hier bovendien strenger dan
Chrome/Firefox: die laatste twee hebben een verborgen instelling om dit
voor lokaal gebruik te omzeilen, Safari niet.

De enige oplossing: de server zelf over HTTPS laten draaien, met een
zelf-ondertekend certificaat dat je één keer op de iPad vertrouwt.

Dit hoeft maar **eenmalig** — zolang het IP-adres van je laptop niet
verandert, blijft het certificaat gewoon werken.

---

## Stap 1 — Certificaat aanmaken (op de laptop)

```bash
cd certs
bash generate-cert.sh
```

Het script:
- detecteert automatisch het huidige LAN-IP van je laptop (vraagt erom als dat niet lukt)
- maakt `server.crt` + `server.key` aan, geldig voor `localhost`, `127.0.0.1` én dat IP-adres
- is 820 dagen geldig (de maximale looptijd die Apple nog vertrouwt)

## Stap 2 — Server starten met HTTPS

```bash
python3 server.py --host 0.0.0.0 --port 8888 --https
```

De opstart-banner toont nu `https://` in plaats van `http://`. Op de
laptop zelf werkt alles meteen zoals voorheen (je browser vertrouwt
`localhost` sowieso, ongeacht het certificaat).

## Stap 3 — Certificaat naar de iPad krijgen

**Aanbevolen: download het rechtstreeks in Safari op de iPad.** Dit is
betrouwbaarder dan AirDrop/mail — die bewaren het bestandstype niet altijd
correct, waardoor iOS meldt *"geen app om dit bestand te openen"*.

Open op de iPad in **Safari**:
```
http://<IP-adres-van-je-laptop>:8888/cert
```
(let op: gewoon `http://`, niet `https://` — dit werkt al vóórdat HTTPS
zelf actief is, downloaden vereist geen secure context)

Safari herkent het certificaat automatisch aan het bestandstype en toont
meteen een melding met **"Sta toe"** om het profiel te bekijken — dan ga
je direct door naar stap 4. (Dit is met Safari geverifieerd; als je liever
Chrome gebruikt weet ik niet zeker of die het downloaden exact hetzelfde
afhandelt — gebruik in dat geval voor de zekerheid Safari voor déze ene
downloadstap, ook als je normaal Chrome gebruikt.)

*Werkte het AirDroppen/mailen bij jou wel prima? Dan kan dat natuurlijk
ook gewoon — dit is enkel de meest betrouwbare methode voor als dat níet
lukte.*

## Stap 4 — Certificaat op de iPad installeren én vertrouwen

Dit zijn **twee aparte stappen** — beide zijn nodig, de eerste alleen is
niet genoeg:

**4a. Installeren:**
1. Na het downloaden (of openen van het geAirDrope'de/gemailde bestand) toont iOS: "Profiel niet ondertekend" met de vraag om het te bekijken → **Sta toe**
2. Ga naar **Instellingen → Algemeen → VPN, DNS & Apparaatbeheer**
3. Tik op het nieuwe profiel ("Zettelkasten Lokale Server") → **Installeer** (rechtsboven)
4. Voer je toegangscode in indien gevraagd, bevestig nogmaals **Installeer**

**4b. Vertrouwen (het stapje dat vaak vergeten wordt):**
1. Ga naar **Instellingen → Algemeen → Info → Certificaatvertrouwensinstellingen**
   (helemaal onderaan, onder "Info")
2. Zet de schakelaar naast **"Zettelkasten Lokale Server"** aan
3. Bevestig de waarschuwing met **Doorgaan**

Zonder deze laatste stap blijft Safari het certificaat als onveilig
beschouwen, ook al staat het al "geïnstalleerd".

## Werkt dit dan voor zowel Safari als Chrome?

Ja — automatisch, zonder aparte stappen. Op iOS/iPadOS is
Apple-beleid dat **elke** browser (Safari, Chrome, Firefox, Edge, ...)
onder de motorkap WebKit moet gebruiken, en ze delen allemaal **dezelfde,
systeembrede certificaatvertrouwensinstellingen** (precies de
Instellingen-app-stappen hierboven). Dit is anders dan op een laptop,
waar Chrome soms zijn eigen certificaatbeheer heeft — op de iPad hoef je
dit dus maar **één keer** te doen, voor alle browsers tegelijk.

## Stap 5 — Openen op de iPad

Ga naar:
```
https://<IP-adres-van-je-laptop>:8888
```
(hetzelfde IP-adres als voorheen, nu met `https://` in plaats van `http://`)

Geen certificaatwaarschuwing meer? Dan werkt het. Voeg de app nu toe aan
het beginscherm (Deel-icoon → "Zet op beginscherm") voor de volledige
PWA-/offline-ervaring.

---

## (Optioneel) Het certificaat ook op de laptop zelf vertrouwen

**Dit is niet nodig voor de iPad** — die heeft z'n eigen vertrouw-stappen
hierboven. Dit is alleen relevant als je op de laptop zelf óók
`https://localhost:8888` zonder certificaatwaarschuwing wilt kunnen
openen.

**Vermijd dubbelklikken op `server.crt`** — dat opent macOS'
Sleutelhangertoegang, die bij zelf-ondertekende certificaten regelmatig
faalt met een cryptische foutmelding als *"Unable to import ... Error:
-25294"* (macOS-code `errSecNoSuchKeychain` — een quirk in de
Sleutelhangertoegang-app zelf, niet een probleem met het certificaat).

Gebruik in plaats daarvan de terminal — betrouwbaarder, en in één
commando meteen als vertrouwd gemarkeerd:

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain certs/server.crt
```

Voer je macOS-wachtwoord in wanneer daarom gevraagd wordt. Herlaad daarna
`https://localhost:8888` — de waarschuwing zou weg moeten zijn.

*Tip: staat Chrome al open? Sluit 'm volledig af (Cmd+Q) en open opnieuw
— Chrome leest de vertrouwensinstellingen alleen bij het opstarten in.*

---

## Als het IP-adres van je laptop verandert

Certificaten zijn gebonden aan het specifieke IP-adres waarvoor ze
gemaakt zijn. Verandert dat (bv. na een routerherstart, of een nieuwe
DHCP-lease) — dan moet je:

1. `bash generate-cert.sh` opnieuw draaien (maakt een nieuw certificaat voor het nieuwe IP)
2. Het nieuwe `server.crt` opnieuw naar de iPad sturen en vertrouwen (stap 3-4 hierboven)

**Tip om dit te voorkomen:** stel op je router een **vaste/gereserveerde
IP-toewijzing** in voor de laptop (vaak te vinden bij "DHCP-reservering"
of "Statisch IP" in de routerinstellingen) — dan verandert het adres
niet meer vanzelf.

---

## Zonder HTTPS blijven werken

Wil je dit (nog) niet instellen? De server werkt gewoon door met `http://`
zoals voorheen (`--https` gewoon weglaten) — alleen offline-gebruik en de
PWA-installatie op andere apparaten dan de laptop zelf werken dan niet.
Lezen/bewerken via de browser met een actieve verbinding blijft altijd
gewoon werken, met of zonder HTTPS.
