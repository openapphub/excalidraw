/**
 * API client — JWT Bearer（本仓），非 AstraDraw Cookie session。
 */

export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_APP_HTTP_STORAGE_BACKEND_URL as
    | string
    | undefined;
  if (envUrl) {
    return envUrl.replace(/\/kv\/?$/, "");
  }
  return `${window.location.origin}/api/v2`;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getErrorPayload(
  response: Response,
  defaultMessage: string,
): Promise<{ message: string; body?: Record<string, unknown> }> {
  try {
    const json = (await response.json()) as Record<string, unknown>;
    let message = defaultMessage;
    if (typeof json.message === "string") {
      message = json.message;
    } else if (typeof json.error === "string") {
      message = json.error;
    }
    return { message, body: json };
  } catch {
    switch (response.status) {
      case 401:
        return { message: "Not authenticated" };
      case 403:
        return { message: "Access denied" };
      case 404:
        return { message: "Not found" };
      case 409:
        return { message: "Conflict" };
      case 413:
        return { message: "Request too large" };
      default:
        return { message: defaultMessage };
    }
  }
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    ...(extra as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit & { errorMessage?: string },
): Promise<T> {
  const { errorMessage = "Request failed", ...fetchOptions } = options || {};
  const headers = authHeaders({
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {}),
  });

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const { message, body } = await getErrorPayload(response, errorMessage);
    throw new ApiError(response.status, message, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function apiRequestRaw(
  path: string,
  options?: RequestInit & { errorMessage?: string },
): Promise<Response> {
  const { errorMessage = "Request failed", ...fetchOptions } = options || {};
  const headers = authHeaders(fetchOptions.headers);
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...fetchOptions,
    headers,
  });
  if (!response.ok) {
    const { message, body } = await getErrorPayload(response, errorMessage);
    throw new ApiError(response.status, message, body);
  }
  return response;
}

export function jsonBody(data: unknown): { body: string } {
  return { body: JSON.stringify(data) };
}

export function binaryBody(data: Blob | ArrayBuffer): RequestInit {
  return {
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: data,
  };
}
