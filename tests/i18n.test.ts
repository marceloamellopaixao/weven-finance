import assert from "node:assert/strict";
import { test } from "node:test";

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

test("i18n dictionaries keep the same keys and placeholders", () => {
  const dictionaries = {
    "pt-BR": flattenDictionary(ptBR),
    "en-US": flattenDictionary(enUS),
    es: flattenDictionary(es),
  };
  const baseDictionary = dictionaries["pt-BR"];
  const baseKeys = Object.keys(baseDictionary).sort();

  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    const keys = Object.keys(dictionary).sort();

    assert.deepEqual(
      keys,
      baseKeys,
      `${locale} must have the same translation keys as pt-BR`,
    );

    for (const key of baseKeys) {
      assert.deepEqual(
        placeholders(dictionary[key]),
        placeholders(baseDictionary[key]),
        `${locale}.${key} must keep the same placeholders as pt-BR`,
      );
    }
  }
});
