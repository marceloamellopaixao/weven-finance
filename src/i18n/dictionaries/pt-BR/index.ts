import { accountProfile } from "./accountProfile";
import { auth } from "./auth";
import { billing } from "./billing";
import { common } from "./common";
import { header } from "./header";
import { landing } from "./landing";
import { locale } from "./locale";
import { seo } from "./seo";
import { settings } from "./settings";
import { validation } from "./validation";

export const ptBR = {
  accountProfile,
  auth,
  billing,
  common,
  header,
  landing,
  locale,
  seo,
  settings,
  validation,
} as const;

type WidenDictionary<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : WidenDictionary<T[K]>;
};

export type Dictionary = WidenDictionary<typeof ptBR>;
