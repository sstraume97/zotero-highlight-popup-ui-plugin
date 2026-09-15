# Streamline Highlight Popup – notater for Claude

Zotero-plugin (bootstrap, uten byggesteg) som erstatter farge- og stilradene i tekstmarkerings-popupen i Zotero-leseren med én rad per stil. Brukeren tester på Windows med Zotero 10 og kommuniserer på norsk. Offentlig README er på engelsk; kodekommentarer og DEVELOPMENT.md er på norsk.

## Arbeidsregel: les kilden, ikke gjett

Flere feil i dette prosjektet kom av antakelser om hvordan Zotero fungerer. Før du endrer noe som berører Zotero-API, innstillingspaneler, manifest eller leseren: slå det opp i kildekoden eller dokumentasjonen under, og henvis til fil/linje. Rå filer kan hentes med `curl https://raw.githubusercontent.com/zotero/zotero/main/<sti>`.

Du kan ikke kjøre Zotero. Si tydelig hva som er verifisert i kilden og hva som bare er testet med syntakssjekk.

## Dokumentasjon og kildekode

- Plugin-mal: https://github.com/windingwind/zotero-plugin-template
- Utviklerguide (zotero-chinese wiki): https://github.com/zotero-chinese/wiki/tree/main/plugin-dev-guide – bl.a. `reference/preference.md`, `reference/manifest.md`, `reference/bootstrap.md`
- zotero-plugin-toolkit: https://github.com/windingwind/zotero-plugin-toolkit – https://windingwind.github.io/zotero-plugin-toolkit/
- zotero-plugin-scaffold: https://github.com/zotero-plugin-dev/zotero-plugin-scaffold – https://zotero-plugin.dev/zotero-plugin-scaffold/
- zotero-types: https://github.com/windingwind/zotero-types – https://www.npmjs.com/package/zotero-types
- Zotero-kildekode: https://github.com/zotero/zotero, https://github.com/zotero/reader, https://github.com/zotero/document-worker
- Zotero-dokumentasjon: https://github.com/zotero/zotero-docs

### Claude-skills for Zotero-plugins (lenke, ikke kopi)

https://github.com/cboulanger/zotero-skills – samling av Claude-skills for Zotero-pluginutvikling, vedlikeholdt av en tredjepart. **Kan brukes, men skal ikke kopieres inn i dette repoet**: det oppdateres fortløpende, så hent alltid gjeldende versjon fra repoet (f.eks. `git clone --depth 1` til scratchpad eller `raw.githubusercontent.com`) når det er relevant.

Aktuelle skills (sjekk repoets README for oppdatert liste):
- `zotero-plugin-dialogs` – dialoger (XHTML), menyer (XUL) og innstillingspaneler
- `zotero-api` – Zoteros JS-API: items, vedlegg, sync, HTTP, DB, notifier, logging
- `zotero-plugin-toolkit` – zotero-plugin-toolkit-API: UITool, dialoger, tastatur, fremdrift, tabeller
- `zotero-plugin-basics` – oppsett, struktur og bygging med zotero-plugin-scaffold
- `saved-search` – lagrede søk via `Zotero.Search`

Merk: flere av disse forutsetter zotero-plugin-scaffold og byggesteg. Denne pluginen er en ren bootstrap-plugin uten bygging, så råd derfra må tilpasses, og påstander om Zotero-oppførsel skal fortsatt kontrolleres mot Zoteros kildekode (se arbeidsregelen over).

## Verifiserte fakta om Zotero

### Innstillingspanel (`Zotero.PreferencePanes.register`)

Kilde: `chrome/content/zotero/preferences/preferences.js` (`_loadPane`, `_initImportedNodesPostInsert`) og `chrome/content/zotero/xpcom/preferencePanes.js`.

- `src` er et XUL-fragment (plugin-paneler har `defaultXUL: true` og parses med `MozXULElement.parseXULToFragment`). Standard navnerom er XUL, HTML-elementer skrives `html:`. Ingen `<?xml?>`, `<!DOCTYPE>` eller `<html>/<body>`.
- **`scripts` lastes inn i en `Cu.Sandbox` før fragmentet er satt inn i dokumentet.** Et skript kan derfor ikke finne panelets elementer når det kjører, og funksjoner det definerer er ikke synlige for inline-attributter som `onload="..."` i vinduet. Inline `<script>` i selve fragmentet kjøres ikke.
- **Bind innstillinger med `preference="full.nøkkel"`.** Zotero leser/skriver med `Zotero.Prefs.get/set(nøkkel, true)` og lytter på `command`, `input` og `change`. Fungerer for `<checkbox>` (checked), `<menulist>`, `html:input` m.m. Zoteros egne innstillinger bruker `<menulist preference="extensions.zotero.itemPaneHeader" native="true">`.
- Etter innsetting sendes en `load`-hendelse til rotelementene i fragmentet. Plugin-malen initialiserer via `onload` på rotelementet som kaller en funksjon på det globale `Zotero`-objektet.
- `html:select` åpnet seg ikke ved klikk i innstillingsvinduet (observert på Zotero 10). Bruk `<menulist>`.

### Innstillinger generelt

- Standardverdier settes i `prefs.js` i plugin-roten med `pref("nøkkel", verdi);`, én per linje (lastes av `xpcom/plugins.js`, `setDefaultPrefs`).
- `Zotero.Prefs.get(nøkkel)` uten `true` legger på prefikset `extensions.zotero.`. Med fulle nøkler må andre argument være `true`.

### Manifest

- `applications.zotero.update_url` er påkrevd. Uten den gir Zotero den misvisende feilen «kan være inkompatibel med denne versjonen».
- `strict_max_version` må dekke installert hovedversjon, f.eks. `"10.0.*"` for Zotero 10.

### Leseren (`renderTextSelectionPopup`)

Kilde: `zotero/reader`, `src/common/components/view-popup/selection-popup.js` og `_view-popup.scss`.

- Plugins kan bare legge til DOM via `append()`. Innholdet havner i `.custom-sections > .section`, som har `border-top` og padding som må overstyres.
- `.selection-popup` har `max-width: 198px` som CSS-regel; bredere innhold klippes uten overstyring.
- Pluginen skjuler `.colors` og `.tool-toggle` og klikker de skjulte knappene. Disse klassenavnene er ikke offentlig API.
- Ved oppgradering uten omstart kan gammel handler fortsatt være registrert. Handleren fjerner derfor tidligere `.shp-grid` før den legger til sin egen.
- En åpen leserfane beholder injisert CSS. Be brukeren restarte Zotero før testing.

## Prosjektrutiner

- **Versjonering: SemVer** (`MAJOR.MINOR.PATCH`) i `addon/manifest.json`. Øk versjonen for *hver* endring som bygges og sendes til brukeren for testing: PATCH for feilrettinger, MINOR for ny funksjonalitet. Ikke gjenbruk et versjonsnummer. Historikk: 0.7.0 = Alt 4, 0.7.1 = `<menulist>`, 0.7.2 = `preference`-binding, 0.7.3 = ikon.
- Release-tag må være nøyaktig `v` + versjonen (`0.7.2` → `v0.7.2`). `.github/workflows/release.yml` avviser annet, bygger XPI og publiserer releasen ved push av tag.
- Lokal bygging: `cd addon && zip -r -X ../streamline-highlight-popup-vX.Y.Z.xpi . -x ".*"`. Legg testbygg i scratchpad, ikke i repoet.
- Ikke commit, push eller tag uten klarsignal fra brukeren.
- Filene sjekkes ut med CRLF på Windows (`.gitattributes: * text=auto`). Tekstbytter i skript må tåle CRLF.
- README: hvert avsnitt på én linje (brukerens ønske).
