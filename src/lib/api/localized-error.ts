import { NextResponse } from "next/server";
import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";
import { apiErrorMessage } from "@/lib/i18n/progress-message";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";
import type { ApiGenerateErrorPayload } from "@/lib/api/json-error-response";
import { apiKeyedErrorText, isApiKeyedError } from "@/lib/api/api-keyed-error";

type ErrorParams = Record<string, string | number | undefined | null>;

export function localizedApiErrorText(
  req: Request,
  key: string,
  params?: ErrorParams,
): string {
  return apiErrorMessage(resolveRequestLocaleSync(req), key, params);
}

export function localizedApiErrorPayload(
  req: Request,
  key: string,
  extra?: { code?: string; requestId?: string; params?: ErrorParams },
): ApiGenerateErrorPayload {
  return {
    error: localizedApiErrorText(req, key, extra?.params),
    errorKey: key,
    ...(extra?.params ? { errorParams: extra.params } : {}),
    ...(extra?.code ? { code: extra.code } : {}),
    ...(extra?.requestId ? { requestId: extra.requestId } : {}),
  };
}

export function localizedJsonError(
  req: Request,
  key: string,
  status: number,
  extra?: { code?: string; requestId?: string; params?: ErrorParams },
): NextResponse<ApiGenerateErrorPayload> {
  return NextResponse.json(localizedApiErrorPayload(req, key, extra), { status });
}

export function localizedStreamError(
  req: Request,
  key: string,
  status: number,
  extra?: { code?: string; requestId?: string; params?: ErrorParams },
): Response {
  return new Response(JSON.stringify(localizedApiErrorPayload(req, key, extra)), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** For handlers that already resolved locale (e.g. stream setup). */
export function apiErrorTextForLocale(
  locale: AppLocale,
  key: string,
  params?: ErrorParams,
): string {
  return apiErrorMessage(locale, key, params);
}

export function studioErrorText(
  req: Request,
  key: string,
  params?: ErrorParams,
): string {
  return tMessage(resolveRequestLocaleSync(req), `studioErrors.${key}`, params);
}

/** Map lib-layer ApiKeyedError (or fallback) to localized API error text. */
export function apiErrorFromUnknown(
  req: Request,
  e: unknown,
  fallbackKey: string,
  params?: ErrorParams,
): string {
  const locale = resolveRequestLocaleSync(req);
  if (isApiKeyedError(e)) return apiKeyedErrorText(locale, e);
  return apiErrorMessage(locale, fallbackKey, params);
}

export function godotFailurePayload(
  req: Request,
  result: {
    errorKey?: string;
    errorParams?: ErrorParams;
    error?: string;
    code: string;
  },
  requestId?: string,
): ApiGenerateErrorPayload {
  if (result.errorKey) {
    return {
      ...localizedApiErrorPayload(req, result.errorKey, {
        requestId,
        params: result.errorParams,
      }),
      code: result.code,
    };
  }
  return {
    error: result.error ?? apiErrorMessage(resolveRequestLocaleSync(req), "godotBuildFailed"),
    code: result.code,
    ...(requestId ? { requestId } : {}),
  };
}
