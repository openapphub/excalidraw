/**
 * Auth API — 本仓 JWT Bearer（AstraDraw 用 cookie，这里多返回 token）
 */
import { getApiBaseUrl, ApiError } from "./api/client";

export interface AuthStatus {
  oidcConfigured: boolean;
  localAuthEnabled: boolean;
  registrationEnabled: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface LocalLoginResult {
  success: boolean;
  user: AuthUser;
  token: string;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const response = await fetch(`${getApiBaseUrl()}/auth/status`);
  return response.json();
}

export async function loginLocal(
  username: string,
  password: string,
): Promise<LocalLoginResult> {
  const response = await fetch(`${getApiBaseUrl()}/auth/login/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message || "Login failed");
  }
  return response.json();
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<LocalLoginResult> {
  const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message || "Registration failed");
  }
  return response.json();
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = localStorage.getItem("token");
  if (!token) {
    return null;
  }
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    headers: authHeaders(),
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function updateProfileApi(data: {
  name?: string;
}): Promise<AuthUser> {
  const response = await fetch(`${getApiBaseUrl()}/auth/profile`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message || "Update failed");
  }
  return response.json();
}

export async function uploadAvatarApi(file: File): Promise<AuthUser> {
  const form = new FormData();
  form.append("avatar", file);
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${getApiBaseUrl()}/auth/avatar`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message || "Upload failed");
  }
  return response.json();
}

export async function deleteAvatarApi(): Promise<AuthUser> {
  const response = await fetch(`${getApiBaseUrl()}/auth/avatar`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message || "Delete failed");
  }
  return response.json();
}
