# @tecleo/content

Textos para escribir: fragmentos de obras de dominio público, listas de palabras frecuentes y fragmentos de código.

## Qué hay

| Archivo                        | Contenido                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/quotes.{es,en}.json` | 160 fragmentos por idioma (60 cortos de 80-140 caracteres, 60 medios de 200-320, 40 largos de 420-600) con autor, obra, ID de Gutenberg y dificultad |
| `src/data/words.{es,en}.json`  | Las 5000 palabras más frecuentes de cada idioma, de más a menos frecuente (las listas de 200 y 1000 son prefijos)                                    |
| `src/data/code.ts`             | Fragmentos de JavaScript, TypeScript, Python y SQL escritos para Tecleo                                                                              |

Los JSON se regeneran con `pnpm --filter @tecleo/content build:corpus`. El script es determinista y guarda las descargas en `.cache/`.

## Origen y licencias

**Fragmentos.** Salen de los libros de [Project Gutenberg](https://www.gutenberg.org) listados en `scripts/sources.ts`. Son solo obras originales (sin traducciones) de autores fallecidos antes de 1956, de dominio público. Se descarta la cabecera y la licencia de Gutenberg; no se usa su marca. Se descartan los fragmentos con:

- diálogos;
- ortografía anterior a 1911 ("fué", "á" como preposición);
- inglés dialectal;
- abreviaturas, números o símbolos raros.

**Listas de palabras.** Salen de [FrequencyWords](https://github.com/hermitdave/FrequencyWords) de Hermit Dave (OpenSubtitles 2018), contenido bajo [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Las listas derivadas de este paquete se distribuyen bajo la misma licencia. Para obtenerlas:

1. Solo se conservan las palabras que también aparecen en minúsculas en las obras de dominio público. Así se van los nombres propios y la jerga de subtítulos.
2. Se quitan los restos de contracciones inglesas.
3. Se quitan los insultos y las palabras de la lista de bloqueo de `scripts/sources.ts`.

**Código.** Escrito para este proyecto.

## Dificultad

`textDifficulty` (0-100) combina:

- la longitud media de palabra;
- la proporción de símbolos, mayúsculas y tildes;
- la proporción de pares de letras poco frecuentes en el idioma, calculada sobre todo el corpus.
