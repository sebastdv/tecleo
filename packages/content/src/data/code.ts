import type { CodeSnippet } from '../types.js';
/** Fragmentos escritos para Tecleo. La sangría se salta sola al escribir; solo se teclea el Enter. */
export const CODE_SNIPPETS: readonly CodeSnippet[] = [
  {
    id: 'code-js-debounce',
    codeLanguage: 'javascript',
    title: 'debounce',
    content: `function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}`,
  },
  {
    id: 'code-js-group-by',
    codeLanguage: 'javascript',
    title: 'groupBy',
    content: `const groupBy = (items, key) =>
  items.reduce((groups, item) => {
    const value = item[key];
    (groups[value] ||= []).push(item);
    return groups;
  }, {});`,
  },
  {
    id: 'code-js-fetch-retry',
    codeLanguage: 'javascript',
    title: 'fetch con reintentos',
    content: `async function fetchWithRetry(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      if (i === attempts) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2 ** i * 100));
  }
  throw new Error(\`No response from \${url}\`);
}`,
  },
  {
    id: 'code-js-counter',
    codeLanguage: 'javascript',
    title: 'contar palabras',
    content: `const text = "el que lee mucho y anda mucho ve mucho y sabe mucho";
const counts = new Map();
for (const word of text.split(" ")) {
  counts.set(word, (counts.get(word) ?? 0) + 1);
}
console.log([...counts].sort((a, b) => b[1] - a[1])[0]);`,
  },
  {
    id: 'code-ts-result',
    codeLanguage: 'typescript',
    title: 'tipo Result',
    content: `type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
function parseAge(input: string): Result<number> {
  const age = Number.parseInt(input, 10);
  if (Number.isNaN(age) || age < 0) {
    return { ok: false, error: new Error("invalid age") };
  }
  return { ok: true, value: age };
}`,
  },
  {
    id: 'code-ts-stack',
    codeLanguage: 'typescript',
    title: 'pila genérica',
    content: `class Stack<T> {
  private items: T[] = [];
  push(item: T): void {
    this.items.push(item);
  }
  pop(): T | undefined {
    return this.items.pop();
  }
  get size(): number {
    return this.items.length;
  }
}`,
  },
  {
    id: 'code-ts-wpm',
    codeLanguage: 'typescript',
    title: 'calcular WPM',
    content: `interface Run {
  correctChars: number;
  durationMs: number;
}
export function wpm({ correctChars, durationMs }: Run): number {
  if (durationMs <= 0) return 0;
  const minutes = durationMs / 60_000;
  return Math.round(correctChars / 5 / minutes);
}`,
  },
  {
    id: 'code-ts-binary-search',
    codeLanguage: 'typescript',
    title: 'búsqueda binaria',
    content: `function binarySearch(sorted: number[], target: number): number {
  let low = 0;
  let high = sorted.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}`,
  },
  {
    id: 'code-py-fizzbuzz',
    codeLanguage: 'python',
    title: 'fizzbuzz',
    content: `def fizzbuzz(limit):
    for n in range(1, limit + 1):
        if n % 15 == 0:
            print("FizzBuzz")
        elif n % 3 == 0:
            print("Fizz")
        elif n % 5 == 0:
            print("Buzz")
        else:
            print(n)`,
  },
  {
    id: 'code-py-dataclass',
    codeLanguage: 'python',
    title: 'dataclass',
    content: `from dataclasses import dataclass, field
@dataclass
class Player:
    name: str
    scores: list[int] = field(default_factory=list)
    def best(self) -> int:
        return max(self.scores, default=0)`,
  },
  {
    id: 'code-py-word-freq',
    codeLanguage: 'python',
    title: 'frecuencia de palabras',
    content: `from collections import Counter
def top_words(path, n=10):
    with open(path, encoding="utf-8") as file:
        words = file.read().lower().split()
    return Counter(words).most_common(n)`,
  },
  {
    id: 'code-py-flatten',
    codeLanguage: 'python',
    title: 'aplanar listas',
    content: `def flatten(items):
    for item in items:
        if isinstance(item, list):
            yield from flatten(item)
        else:
            yield item
print(list(flatten([1, [2, [3, 4]], 5])))`,
  },
  {
    id: 'code-sql-leaderboard',
    codeLanguage: 'sql',
    title: 'ranking semanal',
    content: `SELECT u.nickname, MAX(r.wpm) AS best_wpm
FROM race_results AS r
JOIN users AS u ON u.id = r.user_id
WHERE r.created_at >= NOW() - INTERVAL '7 days'
  AND r.flagged = FALSE
GROUP BY u.nickname
ORDER BY best_wpm DESC
LIMIT 10;`,
  },
  {
    id: 'code-sql-average',
    codeLanguage: 'sql',
    title: 'promedio por idioma',
    content: `SELECT t.language,
  COUNT(*) AS races,
  ROUND(AVG(r.wpm), 1) AS avg_wpm,
  ROUND(AVG(r.accuracy), 1) AS avg_accuracy
FROM race_results AS r
JOIN texts AS t ON t.id = r.text_id
GROUP BY t.language;`,
  },
  {
    id: 'code-sql-create',
    codeLanguage: 'sql',
    title: 'crear tabla',
    content: `CREATE TABLE key_stats (
  user_id UUID NOT NULL REFERENCES users (id),
  key TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, key)
);`,
  },
];
