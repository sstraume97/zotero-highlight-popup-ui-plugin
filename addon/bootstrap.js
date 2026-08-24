/* Streamline Highlight Popup
 *
 * Slår sammen fargevalg og stil (highlight/underline) i tekst-markerings-
 * popupen i Zotero-leseren til to rader (én per stil), slik at farge+stil
 * velges i ett klikk i stedet for to separate steg.
 *
 * Teknikk: Zotero 7+ tilbyr et offisielt "renderTextSelectionPopup"-hook
 * (Zotero.Reader.registerEventListener) som lar plugins legge til DOM i
 * popupen, men ikke erstatte de innebygde radene direkte. Denne pluginen
 * skjuler derfor de opprinnelige radene (".colors" og ".tool-toggle") og
 * bygger sitt eget grensesnitt oppå dem – men klikk på våre knapper
 * trigges videre som ekte klikk på de skjulte, opprinnelige knappene, slik
 * at all faktisk annotasjonslogikk fortsatt eies av Zotero selv. Pluginen
 * "vet" ingenting om hvordan highlights faktisk opprettes.
 *
 * Merk: de interne CSS-klassenavnene (.colors, .color-button, .tool-toggle,
 * .highlight/.underline, .selection-popup) er hentet fra kildekoden til
 * zotero/reader på GitHub og er ikke en offentlig, garantert API. Endres
 * disse i en fremtidig Zotero-versjon, må selectorene i
 * applyColorAndMode()/renderTextSelectionPopupHandler() nedenfor
 * oppdateres. Se README.md.
 *
 * Ikonene (highlight = boks rundt "A", underline = "A" med strek under)
 * er de samme SVG-path'ene som Zotero selv bruker for highlight/underline-
 * knappene, gjenskapt fra brukerens designfil, slik at resultatet ser ut
 * som en naturlig del av leseren.
 */

'use strict';

var PLUGIN_ID = 'streamline-highlight-popup@sondre.local';
var PREF_STYLE = 'extensions.streamlinehighlightpopup.style';
var PREF_SIZE = 'extensions.streamlinehighlightpopup.size';

// Samme rekkefølge/verdier som ANNOTATION_COLORS i zotero/reader sin
// src/common/defines.js.
var ANNOTATION_COLORS = [
	['general-yellow', '#ffd400'],
	['general-red', '#ff6666'],
	['general-green', '#5fb236'],
	['general-blue', '#2ea8e5'],
	['general-purple', '#a28ae5'],
	['general-magenta', '#e56eee'],
	['general-orange', '#f19837'],
	['general-gray', '#aaaaaa'],
];

// "A" i boks (highlight) og "A" med understrek (underline) – samme glyffer
// som Zotero sine egne IconHighlight/IconUnderline, viewBox 0 0 16 16.
var ICON_HIGHLIGHT_D = 'M2,2L14,2L14,14L2,14L2,2ZM1,1L15,1L15,15L1,15L1,1ZM13,13L8.75,3L7.25,3L3,13L4.63,13L5.905,10L10.095,10L11.37,13L13,13ZM8,5.07L6.33,9L9.67,9L8,5.07Z';
var ICON_UNDERLINE_D = 'M13,13L8.75,3L7.25,3L3,13L4.63,13L5.905,10L10.095,10L11.37,13L13,13ZM8,5.07L6.33,9L9.67,9L8,5.07ZM15,15L15,14L1,14L1,15L15,15Z';

var SVG_NS = 'http://www.w3.org/2000/svg';
var STYLE_ID = 'shp-injected-style';
var GRID_CLASS = 'shp-grid';

var CSS = `
/* Zotero pakker plugin-innhold i .custom-sections > .section, som i deres
 * egen _view-popup.scss har "border-top: 1px solid #d7dad7" + padding, og
 * .selection-popup har "max-width: 198px". Begge er CSS-regler (ikke inline
 * stiler), så de må overstyres her – ellers får vi en delelinje over
 * radene våre og knapper som klippes ved kortkanten. */
.selection-popup {
	max-width: none !important;
	width: max-content !important;
}
.selection-popup .custom-sections {
	padding-top: 0 !important;
}
.selection-popup .custom-sections .section {
	padding: 0 !important;
	border-top: 0 !important;
}

/* Alle mål styres av disse variablene, slik at tablet-modus blir én
 * overstyring i stedet for en duplisert kopi av all CSS. */
.${GRID_CLASS} {
	--shp-size: 25px;
	--shp-gap: 4px;
	--shp-icon: 15px;
	--shp-radius: 5px;
	--shp-pad-y: 5px;
	--shp-pad-x: 6px;

	display: flex;
	flex-direction: column;
	gap: var(--shp-gap);
	padding: var(--shp-pad-y) var(--shp-pad-x);
	box-sizing: border-box;
}

/* Tablet/touch: større trykkflater og mer luft mellom dem. */
.${GRID_CLASS}[data-size="tablet"] {
	--shp-size: 40px;
	--shp-gap: 10px;
	--shp-icon: 24px;
	--shp-radius: 8px;
	--shp-pad-y: 8px;
	--shp-pad-x: 10px;
}

.${GRID_CLASS} .shp-row {
	display: flex;
	align-items: center;
	gap: var(--shp-gap);
}
.${GRID_CLASS} .shp-row-label {
	width: var(--shp-size);
	height: var(--shp-size);
	min-width: var(--shp-size);
	min-height: var(--shp-size);
	flex: 0 0 var(--shp-size);
	display: none;
	align-items: center;
	justify-content: center;
	color: #231f20;
	border: 1px solid currentColor;
	border-radius: var(--shp-radius);
	box-sizing: border-box;
}
.${GRID_CLASS} .shp-swatch {
	width: var(--shp-size);
	height: var(--shp-size);
	min-width: var(--shp-size);
	min-height: var(--shp-size);
	flex: 0 0 var(--shp-size);
	padding: 0;
	margin: 0;
	border-radius: var(--shp-radius);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	background: var(--shp-c);
	border: 1px solid rgba(0,0,0,.15);
}
.${GRID_CLASS} .shp-swatch:hover {
	filter: brightness(1.08);
}
.${GRID_CLASS} .shp-swatch:active {
	filter: brightness(0.95);
}
.${GRID_CLASS} .shp-icon,
.${GRID_CLASS} .shp-row-label .shp-icon {
	width: var(--shp-icon);
	height: var(--shp-icon);
	display: block;
	pointer-events: none;
}
.${GRID_CLASS} .shp-icon path {
	fill: currentColor;
}

/* Alt 1: solide fargede firkanter, hvitt ikon */
.${GRID_CLASS}[data-style="alt1"] .shp-swatch {
	color: #fff;
}

/* Alt 2: lys bakgrunn, farget ikon. Kanten må være tydelig nok til at hele
 * knappeflaten leses – med nesten usynlig kant på hvit popup-bakgrunn ser
 * bare ikonet ut som "knappen", og alternativet virker mindre enn Alt 1/3
 * selv om boksene er nøyaktig like store. */
.${GRID_CLASS}[data-style="alt2"] .shp-swatch {
	background: #fff;
	border: 1px solid rgba(0,0,0,.22);
	color: var(--shp-c);
}
@media (prefers-color-scheme: dark) {
	.${GRID_CLASS}[data-style="alt2"] .shp-swatch {
		background: rgba(255,255,255,.06);
		border-color: rgba(255,255,255,.28);
	}
}

/* Alt 3: rene fargeruter uten ikon, én radetikett i stedet */
.${GRID_CLASS}[data-style="alt3"] .shp-swatch .shp-icon {
	display: none;
}
.${GRID_CLASS}[data-style="alt3"] .shp-row-label {
	display: flex;
}
`;

function log(msg) {
	try {
		Zotero.debug('[Streamline Highlight Popup] ' + msg);
	}
	catch (e) {}
}

// Overskriver alltid innholdet, selv om taggen finnes fra før. En allerede
// åpen leser-fane beholder samme "doc" på tvers av at man installerer en ny
// versjon av pluginen – uten dette ville CSS-en fryse fast på en gammel
// versjon til fanen lukkes/Zotero restartes.
function ensureStyle(doc) {
	let style = doc.getElementById(STYLE_ID);
	if (!style) {
		style = doc.createElement('style');
		style.id = STYLE_ID;
		doc.head.appendChild(style);
	}
	style.textContent = CSS;
}


function getStylePref() {
	let v;
	try {
		v = Zotero.Prefs.get(PREF_STYLE, true);
	}
	catch (e) {}
	return v === 'alt1' || v === 'alt3' ? v : 'alt2';
}

function getSizePref() {
	let v;
	try {
		v = Zotero.Prefs.get(PREF_SIZE, true);
	}
	catch (e) {}
	return v === 'tablet' ? 'tablet' : 'normal';
}

function makeIcon(doc, mode) {
	let svg = doc.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.classList.add('shp-icon');
	let path = doc.createElementNS(SVG_NS, 'path');
	path.setAttribute('fill-rule', 'evenodd');
	path.setAttribute('clip-rule', 'evenodd');
	path.setAttribute('d', mode === 'highlight' ? ICON_HIGHLIGHT_D : ICON_UNDERLINE_D);
	svg.appendChild(path);
	return svg;
}

function buildRow(doc, mode, popupRoot) {
	let row = doc.createElement('div');
	row.className = 'shp-row';

	let label = doc.createElement('span');
	label.className = 'shp-row-label';
	label.dataset.mode = mode;
	label.appendChild(makeIcon(doc, mode));
	row.appendChild(label);

	ANNOTATION_COLORS.forEach((entry, index) => {
		let hex = entry[1];
		let btn = doc.createElement('button');
		btn.type = 'button';
		btn.className = 'shp-swatch';
		btn.dataset.mode = mode;
		btn.style.setProperty('--shp-c', hex);
		btn.title = (mode === 'highlight' ? 'Highlight' : 'Underline') + ' – ' + hex;
		btn.appendChild(makeIcon(doc, mode));

		btn.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			applyColorAndMode(popupRoot, mode, index);
		});

		row.appendChild(btn);
	});

	return row;
}

// Klikker de ekte (skjulte) knappene i popupens opprinnelige rader, i
// riktig rekkefølge: først stil-toggle (hvis den ikke allerede er aktiv),
// deretter fargeknappen. Dette gjenbruker Zotero sin egen
// annotasjonslogikk i stedet for å prøve å gjenskape den.
function applyColorAndMode(popupRoot, mode, colorIndex) {
	if (!popupRoot) return;

	let toggleWrap = popupRoot.querySelector('.tool-toggle');
	let targetToggle = toggleWrap && toggleWrap.querySelector('.' + mode);
	let colorButtons = popupRoot.querySelectorAll('.colors .color-button');
	let targetColorBtn = colorButtons && colorButtons[colorIndex];

	if (!targetColorBtn) {
		log('Fant ikke fargeknapp #' + colorIndex + ' – interne selectorer kan ha endret seg.');
		return;
	}

	function clickColor() {
		targetColorBtn.click();
	}

	if (targetToggle && !targetToggle.classList.contains('active')) {
		targetToggle.click();
		// Gi React én runde til å re-rendre "active"-state før vi klikker
		// fargen, ellers kan highlight-klikket lese gammel modus.
		(popupRoot.ownerDocument.defaultView || globalThis)
			.requestAnimationFrame(clickColor);
	}
	else {
		clickColor();
	}
}

function renderTextSelectionPopupHandler(event) {
	try {
		let { doc, append } = event;
		if (!doc) return;

		ensureStyle(doc);

		// Hvis en tidligere versjon av pluginen fortsatt har en registrert
		// handler (skjer ved oppgradering uten omstart), kjører flere
		// handlere etter hverandre og hver legger til sitt eget grid – med
		// dupliserte knapperader som resultat. Fjern alt vi har lagt inn
		// tidligere i denne popupen før vi legger til vårt eget.
		doc.querySelectorAll('.' + GRID_CLASS).forEach((el) => {
			let section = el.closest('.section');
			(section || el).remove();
		});

		let wrapper = doc.createElement('div');
		wrapper.className = GRID_CLASS;
		wrapper.dataset.style = getStylePref();
		wrapper.dataset.size = getSizePref();

		append(wrapper);

		let popupRoot = wrapper.closest('.selection-popup') || doc.querySelector('.selection-popup');
		if (!popupRoot) {
			log('Fant ikke .selection-popup – kan ikke koble til de opprinnelige knappene.');
			return;
		}

		let colorsRow = popupRoot.querySelector('.colors');
		let toggleRow = popupRoot.querySelector('.tool-toggle');
		if (colorsRow) colorsRow.style.display = 'none';
		if (toggleRow) toggleRow.style.display = 'none';

		wrapper.appendChild(buildRow(doc, 'highlight', popupRoot));
		wrapper.appendChild(buildRow(doc, 'underline', popupRoot));
	}
	catch (e) {
		log('Feil i renderTextSelectionPopup-handler: ' + e);
	}
}

function registerPrefPane() {
	try {
		Zotero.PreferencePanes.register({
			pluginID: PLUGIN_ID,
			src: 'prefs.xhtml',
			scripts: ['prefs-script.js'],
			label: 'Highlight Popup',
		});
	}
	catch (e) {
		log('Kunne ikke registrere preference pane: ' + e);
	}
}

async function startup({ id, version, rootURI }, reason) {
	await Zotero.initializationPromise;

	registerPrefPane();
	Zotero.Reader.registerEventListener(
		'renderTextSelectionPopup',
		renderTextSelectionPopupHandler,
		PLUGIN_ID
	);
	log('startet (v' + version + ')');
}

function shutdown(data, reason) {
	try {
		Zotero.Reader.unregisterEventListener(
			'renderTextSelectionPopup',
			renderTextSelectionPopupHandler
		);
	}
	catch (e) {
		log('Kunne ikke avregistrere reader-handler: ' + e);
	}
}

function install(data, reason) {}
function uninstall(data, reason) {}
