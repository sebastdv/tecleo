export type TextLanguage = 'es' | 'en';

export const TEXT_LANGUAGES: readonly TextLanguage[] = ['es', 'en'];

export type LengthCategory = 'short' | 'medium' | 'long';

/** Fragmento de una obra de dominio público. */
export interface Quote {
  readonly id: string;
  readonly language: TextLanguage;
  readonly content: string;
  readonly author: string;
  /** Título de la obra. */
  readonly source: string;
  readonly gutenbergId: number;
  readonly length: number;
  readonly lengthCategory: LengthCategory;
  /** 0 (fácil) – 100 (difícil); ver `textDifficulty`. */
  readonly difficulty: number;
}

export type CodeLanguage = 'javascript' | 'typescript' | 'python' | 'sql';

/** Fragmento de código escrito para el proyecto. */
export interface CodeSnippet {
  readonly id: string;
  readonly codeLanguage: CodeLanguage;
  readonly title: string;
  readonly content: string;
}

export type WordListSize = 200 | 1000 | 5000;

export const WORD_LIST_SIZES: readonly WordListSize[] = [200, 1000, 5000];
