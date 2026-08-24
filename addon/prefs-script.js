/* Kobler nedtrekksmenyene i prefs.xhtml til preferansene manuelt, i stedet
 * for å stole på at det uprefikserte "preference"-attributtet automatisk
 * bindes for et rent HTML <select> inne i en XUL-preference-pane (det
 * gjorde det ikke). */

'use strict';

(function () {
	const SELECTS = [
		{
			id: 'shp-style-select',
			pref: 'extensions.streamlinehighlightpopup.style',
			valid: ['alt1', 'alt2', 'alt3'],
			fallback: 'alt2',
		},
		{
			id: 'shp-size-select',
			pref: 'extensions.streamlinehighlightpopup.size',
			valid: ['normal', 'tablet'],
			fallback: 'normal',
		},
	];

	function bind({ id, pref, valid, fallback }) {
		let select = document.getElementById(id);
		if (!select) {
			return;
		}

		let current;
		try {
			current = Zotero.Prefs.get(pref, true);
		}
		catch (e) {}
		select.value = valid.includes(current) ? current : fallback;

		select.addEventListener('change', () => {
			try {
				Zotero.Prefs.set(pref, select.value, true);
			}
			catch (e) {
				Zotero.debug('[Streamline Highlight Popup] Kunne ikke lagre ' + pref + ': ' + e);
			}
		});
	}

	function init() {
		SELECTS.forEach(bind);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	}
	else {
		init();
	}
})();
