import type { ApiAction, ApiResponse, Session } from "../types";
import { getOrCreateDeviceId } from "../utils/ids";
import { callLocalApi } from "./localAdapter";

type ApiMode = "local" | "gas";

const API_MODE = (import.meta.env.VITE_API_MODE || "local").toLowerCase();
const GAS_URL = import.meta.env.VITE_GAS_URL?.trim();

export function getApiMode(): ApiMode | "invalid" {
  return isApiMode(API_MODE) ? API_MODE : "invalid";
}

function clientError(code: string, message: string): ApiResponse<never> {
  return { ok: false, code, message };
}

function isApiMode(value: string): value is ApiMode {
  return value === "local" || value === "gas";
}

function finalizeResponse<TData>(response: ApiResponse<TData>): ApiResponse<TData> {
  if (!response.ok && response.code === "AUTH_EXPIRED") {
    window.dispatchEvent(new CustomEvent("grandshouse:auth-expired"));
  }
  return response;
}

export async function callApi<TData = unknown>(action: ApiAction, payload: unknown, session?: Session | null): Promise<ApiResponse<TData>> {
  const request = {
    token: session?.token,
    action,
    payload,
    device_id: getOrCreateDeviceId()
  };

  if (!isApiMode(API_MODE)) {
    return clientError("BAD_API_MODE", `Unsupported VITE_API_MODE: ${API_MODE}`);
  }

  if (API_MODE === "local") {
    return finalizeResponse(await callLocalApi<TData>(request));
  }

  if (!GAS_URL) {
    return clientError("GAS_URL_MISSING", "VITE_GAS_URL is required when VITE_API_MODE=gas");
  }

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(request)
    });
    const text = await response.text();
    const parsed = JSON.parse(text) as ApiResponse<TData>;
    if (parsed && typeof parsed === "object" && "ok" in parsed) return finalizeResponse(parsed);
    return clientError("BAD_RESPONSE", "GAS response envelope is invalid");
  } catch (error) {
    return clientError("NETWORK_ERROR", error instanceof Error ? error.message : "Cannot reach GAS endpoint");
  }
}
