# Woordenboeken (Hunspell)

Deze map bevat de Hunspell-woordenboeken voor spellcheck in de Zettelkasten-app.
De bestanden worden **niet** meegeleverd in de repository vanwege hun omvang.

## Installeren

```bash
cd static/vendor
bash download-dictionaries.sh
```

Het script downloadt automatisch:
- `nl_NL.dic` + `nl_NL.aff` — Nederlands (OpenTaal ~400k woorden)
- `en_US.dic` + `en_US.aff` — Engels (LibreOffice/SCOWL ~600k woorden)

## Handmatig

| Taal | .dic | .aff | Bron |
|------|------|------|------|
| Nederlands | nl_NL.dic | nl_NL.aff | [OpenTaal](https://github.com/OpenTaal/opentaal-hunspell) |
| Engels | en_US.dic | en_US.aff | [LibreOffice](https://github.com/LibreOffice/dictionaries/tree/master/en) |

Zet de bestanden in deze map (`static/vendor/dict/`) en herstart `server.py`.

## Zoekpaden (prioriteit)

De server zoekt in deze volgorde:
1. `static/vendor/dict/` ← **hier** (ingebakken in app)
2. Vault-map (eigen woordenlijst)
3. Homebrew (`/opt/homebrew/share/hunspell/`)
4. LibreOffice bundled
5. Systeem (`/usr/share/hunspell/`)
6. Ingebakken minimale fallback
