# Streamline Highlight Popup (Zotero-plugin)

Lett Zotero-plugin som slår sammen farge- og stilvalg i tekstmarkerings-
popupen (highlight vs. understreking) til én rad per stil, slik at
farge+stil velges i ett klikk – basert på ideen beskrevet i
`streamline the highlight style popup.md`.

Alle fire design-alternativene er implementert som CSS-varianter du bytter
mellom i innstillingene:

- **Alt 1** – solide fargede firkanter med hvitt ikon
- **Alt 2** – lys bakgrunn, farget ikon (standard)
- **Alt 3** – rene fargeruter uten ikon, med én radetikett foran hver rad
- **Alt 4** – Alt 1 for highlight-raden, Alt 2 for understrekingsraden (forslag fra u/thambos på Reddit)

Alle knapper er 25×25 px i alle tre variantene.

## Hvordan det virker

Zotero har et offisielt hook,
`Zotero.Reader.registerEventListener('renderTextSelectionPopup', …)`, som
lar plugins legge til DOM i popupen – men ikke erstatte de innebygde
radene. Pluginen skjuler derfor de to opprinnelige radene (fargerad og
highlight/underline-toggle) og legger et eget grensesnitt oppå. Et klikk på
en av våre swatches trigger et ekte klikk først på den skjulte
stil-toggleknappen (hvis nødvendig), så på den skjulte fargeknappen – all
faktisk annotasjonslogikk eies fortsatt 100 % av Zotero selv.

## Ting som ikke er åpenbare (lært den harde veien)

Notert her fordi hvert av disse punktene kostet en feilsøkingsrunde:

- **`update_url` er påkrevd i manifest.json.** Uten feltet nekter Zotero å
  installere, med den misvisende meldingen «kan være inkompatibel med denne
  versjonen». Verdien kan peke på en adresse som ikke finnes når man ikke
  distribuerer via oppdateringsserver.
- **`strict_max_version` må matche installert major.** For Zotero 10:
  `"10.0.*"`. Verken `"*"` eller `"10.*"` godtas.
- **`prefs.xhtml` er et XUL-*fragment*.** Ingen `<?xml?>`, `<!DOCTYPE>`
  eller `<html>/<body>` – det gir «XML or text declaration not at start of
  entity» og et panel som ikke åpner seg.
- **Innstillinger bindes med `preference`-attributtet, ikke med skript.** Zotero laster filene i `scripts: [...]` inn i en sandkasse *før* panelets XHTML er satt inn i dokumentet (`_loadPane` i Zoteros `preferences/preferences.js`), så et skript finner ikke menyene når det kjører. Inline `<script>` i fragmentet kjøres heller ikke. Sett i stedet `preference="full.nøkkel"` på elementet; Zotero leser og skriver da innstillingen selv. Bruk `<menulist>` for nedtrekksmenyer – `html:select` åpnet seg ikke ved klikk.
- **Zotero wrapper plugin-innhold i `.custom-sections > .section`**, som i
  deres egen `_view-popup.scss` har `border-top: 1px solid #d7dad7`. Den
  delelinjen kommer altså fra Zotero, ikke fra pluginens egen CSS, og må
  overstyres.
- **`.selection-popup` har `max-width: 198px`** som CSS-regel (ikke inline
  stil), så knapperader som er bredere blir klippet med mindre regelen
  overstyres.
- **Handleren må være idempotent.** Ved oppgradering uten omstart kan den
  gamle versjonens handler fortsatt være registrert; da kjører begge og
  legger til hvert sitt knappe-grid. Handleren rydder derfor bort tidligere
  grid før den legger til sitt eget.

## Interne selectorer

Klassenavnene popupen bruker (`.colors`, `.color-button`, `.tool-toggle`,
`.highlight`/`.underline`, `.selection-popup`, `.custom-sections`,
`.section`) er hentet fra kildekoden til
[zotero/reader](https://github.com/zotero/reader) og er ikke en garantert
offentlig API. Endres de i en framtidig Zotero-versjon, må selectorene i
`applyColorAndMode()` og CSS-blokken i `addon/bootstrap.js` oppdateres.

## Bygge og installere

```bash
cd addon && zip -r ../streamline-highlight-popup.xpi . -x ".*"
```

I Zotero: **Verktøy → Add-ons → tannhjul → Install Add-on From File…**

Bytt design-variant under **Rediger → Innstillinger → Highlight Popup**.

**Merk ved testing:** lukk åpne PDF-faner (eller restart Zotero) etter
installasjon av en ny versjon – en allerede åpen lesertab kan ellers vise
gammel CSS eller kjøre gammel handler.

For raskere iterasjon under utvikling kan du bruke Zoteros «proxy
file»-metode: lag en fil `streamline-highlight-popup@sondre.local` (uten
endelse) i `extensions/`-mappen i Zotero-profilen, med den absolutte stien
til `addon/`-mappen som innhold, og skru på
`extensions.experiments.enabled` i `about:config`.

## Release

Releaser bygges automatisk av [`.github/workflows/release.yml`](.github/workflows/release.yml) når en tag som begynner med `v` pushes:

1. Sett `version` i `addon/manifest.json`, f.eks. `0.8.0`.
2. Commit og push.
3. Lag og push taggen:

   ```bash
   git tag v0.8.0
   git push origin v0.8.0
   ```

Versjonering følger [SemVer](https://semver.org/): `MAJOR.MINOR.PATCH`. Øk PATCH for feilrettinger, MINOR for ny funksjonalitet (f.eks. et nytt design-alternativ) og MAJOR for endringer som bryter eksisterende oppførsel. Hvert bygg som deles for testing får nytt versjonsnummer.

Workflowen sjekker først at versjonen i manifestet er gyldig SemVer og at taggen er nøyaktig `v` + versjonen (`0.8.0` → `v0.8.0`), syntakssjekker `bootstrap.js`, bygger `streamline-highlight-popup-v0.8.0.xpi` og lager en GitHub-release med filen og automatisk genererte release notes. Stemmer ikke versjonene, stopper den før noe publiseres.
