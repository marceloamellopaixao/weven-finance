import { enUS } from "../src/i18n/dictionaries/en-US";
import { es } from "../src/i18n/dictionaries/es";
import { ptBR } from "../src/i18n/dictionaries/pt-BR";

type FlatDictionary = Record<string, string>;

const placeholderPattern = /\{([a-zA-Z0-9_]+)\}/g;

function flattenDictionary(value: unknown, prefix = "", output: FlatDictionary = {}) {
  if (typeof value === "string") {
    output[prefix] = value;
    return output;
  }

  if (!value || typeof value !== "object") return output;

  for (const [key, child] of Object.entries(value)) {
    flattenDictionary(child, prefix ? `${prefix}.${key}` : key, output);
  }

  return output;
}

function placeholders(message: string) {
  return Array.from(message.matchAll(placeholderPattern), (match) => match[1]).sort();
}

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

const dictionaries = {
  "pt-BR": flattenDictionary(ptBR),
  "en-US": flattenDictionary(enUS),
  es: flattenDictionary(es),
};

const baseLocale = "pt-BR";
const baseDictionary = dictionaries[baseLocale];
const baseKeys = Object.keys(baseDictionary).sort();
const errors: string[] = [];

for (const [locale, dictionary] of Object.entries(dictionaries)) {
  if (locale === baseLocale) continue;

  const keys = Object.keys(dictionary).sort();
  const missing = baseKeys.filter((key) => !Object.prototype.hasOwnProperty.call(dictionary, key));
  const extra = keys.filter((key) => !Object.prototype.hasOwnProperty.call(baseDictionary, key));

  for (const key of missing) errors.push(`[${locale}] missing key: ${key}`);
  for (const key of extra) errors.push(`[${locale}] extra key: ${key}`);

  for (const key of baseKeys) {
    if (!Object.prototype.hasOwnProperty.call(dictionary, key)) continue;

    const expected = placeholders(baseDictionary[key]);
    const actual = placeholders(dictionary[key]);
    if (!sameList(expected, actual)) {
      errors.push(
        `[${locale}] placeholder mismatch for ${key}: expected {${expected.join(", ")}} got {${actual.join(", ")}}`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`i18n validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`i18n validation passed for ${Object.keys(dictionaries).join(", ")}.`);
