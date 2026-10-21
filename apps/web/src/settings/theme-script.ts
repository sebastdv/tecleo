import { THEMES } from '@tecleo/shared';

import { SETTINGS_STORAGE_KEY } from './storage-key';

/**
 * Se ejecuta en `<head>` antes del primer pintado: aplica tema, tipografía y tamaño guardados
 * para que no haya un destello con el tema por defecto. Si algo falla, queda el tema por defecto.
 */
export const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)})||'{}').state;s=s&&s.settings;if(!s)return;var d=document.documentElement;var t=${JSON.stringify(THEMES)};if(t.indexOf(s.theme)>=0)d.dataset.theme=s.theme;if(s.gameFont)d.dataset.font=s.gameFont;if(s.gameFontSize)d.dataset.size=s.gameFontSize;}catch(e){}})();`;
