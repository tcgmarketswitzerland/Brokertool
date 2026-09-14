import { THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Laeuft vor dem ersten Anstrich und setzt data-theme, damit die Seite nicht
 * kurz im falschen Modus aufblitzt. Das ist der einzige Ort im Projekt mit
 * einem eingebetteten Skript - jede andere Loesung erzeugt genau dieses
 * Flackern beim Laden.
 *
 * Die Themewahl ist eine reine Anzeigeeinstellung ohne Personenbezug und
 * darf deshalb im Browser gespeichert werden (vgl. ADR-002).
 */
export function ThemeScript() {
  const script = `(function(){try{
    var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
