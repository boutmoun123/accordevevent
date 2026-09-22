import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, saveTokens } from "./api";

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
const response = (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status });

describe("API client", () => {
  it("unwraps backend envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { success: true, data: { count: 3 } })));
    expect(await api.get("/matching/count")).toEqual({ count: 3 });
  });
  it("preserves validation status, code, and message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(422, { success: false, error: { code: "VALIDATION_ERROR", message: "راجع العمر" } })));
    await expect(api.post("/male/request", {})).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR", message: "راجع العمر" });
  });
  it("reports network failures clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(api.get("/me")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });
  it("rotates refresh tokens and retries with the new access token", async () => {
    saveTokens({ access_token: "old-access", refresh_token: "old-refresh", token_type: "bearer" });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(response(200, { success: true, data: { access_token: "new-access", refresh_token: "new-refresh" } }))
      .mockResolvedValueOnce(response(200, { success: true, data: { id: "user" } }));
    vi.stubGlobal("fetch", fetcher);
    expect(await api.me()).toEqual({ id: "user" });
    expect(fetcher.mock.calls[2][1].headers.get("Authorization")).toBe("Bearer new-access");
    expect(localStorage.getItem("farah_refresh_token")).toBe("new-refresh");
  });
  it("does not refresh on a forbidden matchmaker request", async () => {
    saveTokens({ access_token: "access", refresh_token: "refresh", token_type: "bearer" });
    const fetcher = vi.fn().mockResolvedValue(response(403, { error: { message: "بانتظار الاعتماد" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(api.get("/matchmaker/dashboard")).rejects.toMatchObject({ status: 403 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("shares one refresh across concurrent expired requests", async () => {
    saveTokens({ access_token: "old", refresh_token: "refresh", token_type: "bearer" });
    let finishRefresh: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => { finishRefresh = resolve; });
    const fetcher = vi.fn((url: string, options: RequestInit) => {
      if (url.endsWith("/auth/refresh")) return pending;
      const authorized = new Headers(options.headers).get("Authorization") === "Bearer new";
      return Promise.resolve(response(authorized ? 200 : 401, { success: true, data: {} }));
    });
    vi.stubGlobal("fetch", fetcher);
    const requests = Promise.all([api.me(), api.get("/male/request")]);
    await vi.waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1));
    finishRefresh(response(200, { success: true, data: { access_token: "new", refresh_token: "rotated" } }));
    await requests;
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  });
  it("clears local tokens even when logout fails", async () => {
    saveTokens({ access_token: "access", refresh_token: "refresh", token_type: "bearer" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(api.logout()).rejects.toThrow();
    expect(localStorage.getItem("farah_access_token")).toBeNull();
    expect(localStorage.getItem("farah_refresh_token")).toBeNull();
  });
});
