import assert from "node:assert/strict";
import test from "node:test";

import { formatMoney, getCurrencySymbol, normalizeCurrency, parseMoneyInput } from "../src/lib/money/formatMoney";

test("formats supported currencies with locale-aware Intl", () => {
  assert.equal(formatMoney(19.9, "BRL", "pt-BR"), "R$ 19,90");
  assert.equal(formatMoney(4.99, "USD", "en-US"), "$4.99");
  assert.equal(formatMoney(4.99, "EUR", "es"), "4,99 €");
});

test("parses money inputs by locale", () => {
  assert.equal(parseMoneyInput("1.234,56", "pt-BR"), 1234.56);
  assert.equal(parseMoneyInput("1,234.56", "en-US"), 1234.56);
});

test("normalizes unsupported currencies to BRL", () => {
  assert.equal(normalizeCurrency("GBP"), "BRL");
  assert.equal(getCurrencySymbol("EUR"), "€");
});
