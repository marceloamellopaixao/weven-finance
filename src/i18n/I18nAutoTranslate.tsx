"use client";

import { useEffect } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { translateUiText } from "@/i18n/uiText";

const TEXT_SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE"]);
const ATTRIBUTE_SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE"]);
type TextNodeTranslation = {
  original: string;
  translated: string;
};

const TEXT_NODE_TRANSLATIONS = new WeakMap<Text, TextNodeTranslation>();
const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;
const ATTRIBUTE_ORIGINAL = new WeakMap<Element, Partial<Record<(typeof ATTRIBUTES)[number], string>>>();

function shouldSkip(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest("[data-i18n-skip]")) || TEXT_SKIP_TAGS.has(parent.tagName);
}

function translateTextNode(node: Text, locale: Parameters<typeof translateUiText>[0]) {
  if (shouldSkip(node)) return;
  const current = node.nodeValue ?? "";
  const previous = TEXT_NODE_TRANSLATIONS.get(node);
  const original = previous && (current === previous.original || current === previous.translated)
    ? previous.original
    : current;
  if (!original.trim()) return;
  const translated = translateUiText(locale, original);
  TEXT_NODE_TRANSLATIONS.set(node, { original, translated });
  if (node.nodeValue !== translated) node.nodeValue = translated;
}

function translateAttributes(element: Element, locale: Parameters<typeof translateUiText>[0]) {
  if (element.closest("[data-i18n-skip]") || ATTRIBUTE_SKIP_TAGS.has(element.tagName)) return;
  const originalByAttribute = ATTRIBUTE_ORIGINAL.get(element) ?? {};

  ATTRIBUTES.forEach((attribute) => {
    const value = originalByAttribute[attribute] ?? element.getAttribute(attribute);
    if (!value || !value.trim()) return;
    originalByAttribute[attribute] = value;
    const translated = translateUiText(locale, value);
    if (element.getAttribute(attribute) !== translated) {
      element.setAttribute(attribute, translated);
    }
  });

  ATTRIBUTE_ORIGINAL.set(element, originalByAttribute);
}

function translateTree(root: ParentNode, locale: Parameters<typeof translateUiText>[0]) {
  if ("querySelectorAll" in root) {
    root.querySelectorAll("*").forEach((element) => translateAttributes(element, locale));
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node as Text, locale);
    node = walker.nextNode();
  }
}

export function I18nAutoTranslate() {
  const { locale } = useI18n();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_I18N_AUTO_TRANSLATE_ENABLED !== "true") return;

    let frame = 0;
    const run = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => translateTree(document.body, locale));
    };

    run();
    const observer = new MutationObserver((mutations) => {
      let shouldRun = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) shouldRun = true;
        if (mutation.type === "attributes") shouldRun = true;
      });
      if (shouldRun) run();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [locale]);

  return null;
}
