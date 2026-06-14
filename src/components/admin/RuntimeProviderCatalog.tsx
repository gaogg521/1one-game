"use client";

import { useTranslations } from "next-intl";
import {
  getProviderTemplate,
  protocolDisplayKey,
  PROVIDER_TEMPLATE_GROUPS,
  PROVIDER_TEMPLATES,
  type ProviderTemplateId,
} from "@/lib/runtime-provider-templates";

function noteText(t: ReturnType<typeof useTranslations>, noteKey: string): string {
  const key = `templateNotes.${noteKey}` as Parameters<typeof t>[0];
  return t.has(key) ? t(key) : "";
}

/** 选中模板后展示的紧凑提示（非 custom） */
export function RuntimeProviderTemplateHint({ templateId }: { templateId: ProviderTemplateId }) {
  const t = useTranslations("adminPage.runtimeConfig");
  const tpl = getProviderTemplate(templateId);
  if (!tpl || tpl.id === "custom") return null;

  const note = noteText(t, tpl.noteKey);
  if (!note) return null;

  return (
    <p
      className="text-xs leading-relaxed text-[var(--gc-text-faint)]"
      data-testid="admin-runtime-template-hint"
    >
      <span className="text-[var(--gc-muted)]">{tpl.vendor}</span>
      {" · "}
      {note}
      {tpl.docsUrl ? (
        <>
          {" "}
          <a
            href={tpl.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 hover:text-sky-200"
          >
            {t("catalogOpenDocs")} ↗
          </a>
        </>
      ) : null}
    </p>
  );
}

export function RuntimeProviderTemplateSelect({
  value,
  onChange,
  inputCls,
}: {
  value: ProviderTemplateId;
  onChange: (id: ProviderTemplateId) => void;
  inputCls: string;
}) {
  const t = useTranslations("adminPage.runtimeConfig");

  return (
    <select
      className={`${inputCls} min-w-[200px] max-w-full py-2.5`}
      value={value}
      onChange={(e) => onChange(e.target.value as ProviderTemplateId)}
      data-testid="admin-runtime-template-select"
    >
      {PROVIDER_TEMPLATE_GROUPS.map((group) => (
        <optgroup key={group.category} label={t(group.labelKey)}>
          {PROVIDER_TEMPLATES.filter((tpl) => tpl.category === group.category).map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.vendor} — {tpl.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** 下拉变更时展示 Base URL / 协议参考（单行） */
export function RuntimeProviderTemplateMeta({ templateId }: { templateId: ProviderTemplateId }) {
  const t = useTranslations("adminPage.runtimeConfig");
  const tpl = getProviderTemplate(templateId);
  if (!tpl || tpl.id === "custom" || !tpl.baseUrl) return null;

  return (
    <p className="font-mono text-[11px] text-[var(--gc-text-faint)]">
      {t(protocolDisplayKey(tpl.protocol))}
      {" · "}
      {tpl.baseUrl}
    </p>
  );
}
