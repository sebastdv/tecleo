import type { TextDto } from '@tecleo/shared';

import type { Text } from '../generated/prisma/client.js';

export function toTextDto(text: Text): TextDto {
  const lengthCategory = text.lengthCategory;
  return {
    id: text.id,
    content: text.content,
    language: text.language === 'en' ? 'en' : 'es',
    type: text.type === 'code' ? 'code' : 'quote',
    author: text.author,
    source: text.source,
    length: text.length,
    lengthCategory:
      lengthCategory === 'short' || lengthCategory === 'medium' || lengthCategory === 'long'
        ? lengthCategory
        : null,
    difficulty: text.difficulty,
  };
}
