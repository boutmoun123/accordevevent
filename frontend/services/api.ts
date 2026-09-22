import type {
  ApiEnvelope,
  AuthSession,
  AuthTokens,
  MalePhoneChallenge,
  MeResponse,
  User,
} from "@/types";
const BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8015/api/v1"
).replace(/\/$/, "");
const ACCESS = "farah_access_token",
  REFRESH = "farah_refresh_token";
let refreshInFlight: Promise<AuthTokens> | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "API_ERROR",
  ) {
    super(message);
  }
}
const storage = {
  get: (k: string) =>
    typeof window !== "undefined" ? localStorage.getItem(k) : null,
  set: (k: string, v: string) =>
    typeof window !== "undefined" && localStorage.setItem(k, v),
  remove: (k: string) =>
    typeof window !== "undefined" && localStorage.removeItem(k),
};
function unwrap<T>(value: ApiEnvelope<T> | T): T {
  if (value && typeof value === "object" && "success" in value) {
    const env = value as ApiEnvelope<T>;
    if (!env.success)
      throw new ApiError(
        env.error?.message || "تعذر تنفيذ الطلب",
        400,
        env.error?.code,
      );
    return env.data;
  }
  return value as T;
}
async function raw<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = storage.get(ACCESS);
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجددًا.",
      0,
      "NETWORK_ERROR",
    );
  }
  if (response.status === 401 && retry && storage.get(REFRESH)) {
    try {
      if (!refreshInFlight) {
        refreshInFlight = raw<AuthTokens>(
          "/auth/refresh",
          {
            method: "POST",
            body: JSON.stringify({ refresh_token: storage.get(REFRESH) }),
          },
          false,
        ).then((tokens) => {
          saveTokens(tokens);
          return tokens;
        }).finally(() => { refreshInFlight = null; });
      }
      await refreshInFlight;
      return raw<T>(path, options, false);
    } catch {
      clearTokens();
    }
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      payload?.error?.message || payload?.detail || "حدث خطأ غير متوقع",
      response.status,
      payload?.error?.code,
    );
  return unwrap<T>(payload);
}
export function saveTokens(t: AuthTokens) {
  storage.set(ACCESS, t.access_token);
  storage.set(REFRESH, t.refresh_token);
}
export function clearTokens() {
  storage.remove(ACCESS);
  storage.remove(REFRESH);
}
type AuthResult = AuthTokens & {
  tokens?: AuthTokens;
  user?: User;
  is_new_user?: boolean;
  active_request?: AuthSession["active_request"];
  conversation?: AuthSession["conversation"];
};
function normalizeAuth(value: AuthResult): AuthSession {
  const tokens = value.tokens || value;
  saveTokens(tokens);
  return { ...value, ...tokens, tokens };
}
const passwordLogin = async (identifier: string, password: string) =>
  normalizeAuth(
    await raw<AuthResult>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ phone: identifier, password }),
      },
      false,
    ),
  );
export const api = {
  get: <T>(p: string) => raw<T>(p),
  post: <T>(p: string, b?: unknown) =>
    raw<T>(p, {
      method: "POST",
      body: b === undefined ? undefined : JSON.stringify(b),
    }),
  patch: <T>(p: string, b: unknown) =>
    raw<T>(p, { method: "PATCH", body: JSON.stringify(b) }),
  delete: <T>(p: string) => raw<T>(p, { method: "DELETE" }),
  login: passwordLogin,
  staffLogin: passwordLogin,
  startMalePhone: async (phone: string) =>
    normalizeAuth(
      await raw<AuthResult & MalePhoneChallenge>(
        "/auth/male/phone/start",
        { method: "POST", body: JSON.stringify({ phone }) },
        false,
      ),
    ) as AuthSession & MalePhoneChallenge,
  verifyMalePhone: async (challengeId: string, otp: string) =>
    normalizeAuth(
      await raw<AuthResult>(
        "/auth/male/phone/verify",
        {
          method: "POST",
          body: JSON.stringify({ challenge_id: challengeId, otp }),
        },
        false,
      ),
    ),
  loginMaleWithRequestCode: async (requestCode: string) =>
    normalizeAuth(
      await raw<AuthResult>(
        "/auth/male/request-code",
        {
          method: "POST",
          body: JSON.stringify({ request_code: requestCode }),
        },
        false,
      ),
    ),
  register: async (data: unknown) =>
    normalizeAuth(
      await raw<AuthResult>(
        "/auth/register",
        { method: "POST", body: JSON.stringify(data) },
        false,
      ),
    ),
  me: () => raw<MeResponse>("/me"),
  logout: async () => {
    try {
      await raw(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: storage.get(REFRESH) }),
        },
        false,
      );
    } finally {
      clearTokens();
    }
  },
};
