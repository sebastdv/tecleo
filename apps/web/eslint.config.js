import nextVitals from 'eslint-config-next/core-web-vitals';
import { base } from '@tecleo/eslint-config';

const config = [...nextVitals, ...base({ tsconfigRootDir: import.meta.dirname, env: 'browser' })];

export default config;
