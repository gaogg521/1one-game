import { test as base, expect } from "@playwright/test";
import { addZhLocaleCookie } from "./helpers/locale";

/** 默认 zh-Hans；i18n 英文路径测试请直接用 @playwright/test 并自建 context */
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await addZhLocaleCookie(context, baseURL);
    await use(context);
  },
});

export { expect };
