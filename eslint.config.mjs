import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from 'eslint-config-next';

/**
 * Architekturregeln R1-R6 aus docs/03-architektur.md, Abschnitt 1.
 * Diese Konfiguration erzwingt die Schichtengrenzen, damit sie nicht von
 * Disziplin abhaengen.
 */
export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'src/types/database.generated.ts'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Typgestuetztes Linting nur fuer den eigenen Quellcode: eslint-config-next
  // bringt einen eigenen Parser mit, der parserOptions.project nicht
  // weiterreicht. Deshalb hier explizit der tseslint-Parser.
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'scripts/**/*.mjs'],
    ignores: ['scripts/**/*.mjs'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },

  // R1: Die Domaene ist framework-frei. Sie laeuft auch in einem nackten
  //     Node-Skript - das ist die Bedingung dafuer, dass die fachlichen Tests
  //     ohne Datenbank und ohne React laufen koennen.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-dom', 'next', 'next/*'], message: 'R1: src/domain ist framework-frei.' },
          { group: ['@supabase/*'], message: 'R1: src/domain kennt keine Datenbank.' },
          { group: ['@/app/*', '@/components/*', '@/features/*', '@/lib/*', '@/services/*'],
            message: 'R1: src/domain darf nur innerhalb der Domaene importieren.' },
        ],
      }],
    },
  },

  // R2: supabase-js gehoert nicht in die Oberflaeche.
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@supabase/*'], message: 'R2: Datenzugriff laeuft ueber lib/supabase und die Repositories.' }],
      }],
    },
  },

  // R3: Der service_role-Key umgeht RLS vollstaendig und wird in genau einer
  //     Datei gelesen. Ergaenzend prueft scripts/check-service-role.mjs den
  //     gesamten Baum, weil ESLint nur Imports sieht, keine env-Zugriffe.
  {
    files: ['src/**/*.{ts,tsx}'],
    // env.ts ist die einzige Stelle, die process.env liest (Architektur 14);
    // admin.ts ist die einzige, die den service_role-Key verwenden darf (R3).
    ignores: ['src/lib/env.ts', 'src/lib/supabase/admin.ts'],
    rules: {
      'no-restricted-properties': ['error', {
        object: 'process',
        property: 'env',
        message: 'Umgebungsvariablen ausschliesslich ueber @/lib/env (R3, Architektur 14).',
      }],
    },
  },
);
