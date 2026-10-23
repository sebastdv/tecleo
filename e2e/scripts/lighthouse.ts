/**
 * Lighthouse sobre la web en marcha (spec 13: ≥ 90 en rendimiento y accesibilidad en el
 * inicio). Usa el Chromium de Playwright y la configuración móvil por defecto de Lighthouse
 * (CPU y red simuladas). Mide varias veces y se queda con la mediana: una sola corrida varía.
 *
 *   pnpm build && pnpm --filter @tecleo/web start   # en otra terminal (con el server)
 *   pnpm lighthouse [url] [corridas]
 */
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const url = process.argv[2] ?? 'http://localhost:3100/es';
const runs = Number(process.argv[3] ?? 3);
const TARGETS = { performance: 90, accessibility: 90 } as const;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

const scores = new Map<string, number[]>();
for (let run = 1; run <= runs; run++) {
  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless=new'],
  });
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      onlyCategories: CATEGORIES,
      logLevel: 'error',
    });
    if (!result) throw new Error('Lighthouse no devolvió resultados');
    const { categories, audits } = result.lhr;
    const line = CATEGORIES.map((id) => {
      const score = Math.round((categories[id]?.score ?? 0) * 100);
      scores.set(id, [...(scores.get(id) ?? []), score]);
      return `${id} ${score}`;
    });
    const lcp = audits['largest-contentful-paint']?.displayValue ?? '?';
    console.log(`Corrida ${run}: ${line.join(' · ')} · LCP ${lcp}`);
  } finally {
    chrome.kill();
  }
}

let failed = false;
for (const [id, target] of Object.entries(TARGETS)) {
  const value = median(scores.get(id) ?? []);
  const ok = value >= target;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${id}: mediana ${value} (objetivo ≥ ${target})`);
}
process.exitCode = failed ? 1 : 0;
