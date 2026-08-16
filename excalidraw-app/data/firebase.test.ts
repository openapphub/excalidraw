import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadFromFirebase, saveToFirebase } from "./firebase";

vi.mock("@excalidraw/excalidraw/data/encryption", () => ({
  encryptData: async (_key: string, data: Uint8Array) => ({
    encryptedBuffer: data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ),
    iv: new Uint8Array(12),
  }),
  decryptData: async (_iv: Uint8Array, ciphertext: Uint8Array<ArrayBuffer>) =>
    ciphertext.buffer.slice(
      ciphertext.byteOffset,
      ciphertext.byteOffset + ciphertext.byteLength,
    ),
}));

const encodedEmptyScene = window.btoa("[]");
const encodedIV = window.btoa("\0".repeat(12));

const createPortal = () =>
  ({
    roomId: "0123456789abcdefabcd",
    roomKey: "jUgf6TAAvOrLXbsmq4Hpnw",
    socket: {},
  } as any);

describe("自建协作房间快照", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("通过同源 REST 保存并恢复加密快照", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        requests.push({ url, init });
        if (!init?.method) {
          return new Response("not found", { status: 404 });
        }
        const body = JSON.parse(String(init.body));
        return Response.json({
          revision: 1,
          sceneVersion: body.sceneVersion,
          ciphertext: body.ciphertext,
          iv: body.iv,
          updatedAt: "2026-08-16T00:00:00Z",
        });
      }),
    );

    const portal = createPortal();
    await expect(saveToFirebase(portal, [], {} as any)).resolves.toEqual([]);
    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe("/api/v2/collab/rooms/0123456789abcdefabcd");
    expect(requests[0].init?.cache).toBe("no-store");
    expect(requests[1].init?.method).toBe("PUT");
    expect(JSON.parse(String(requests[1].init?.body))).toMatchObject({
      expectedRevision: 0,
      ciphertext: encodedEmptyScene,
      iv: encodedIV,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          revision: 1,
          sceneVersion: 0,
          ciphertext: encodedEmptyScene,
          iv: encodedIV,
          updatedAt: "2026-08-16T00:00:00Z",
        }),
      ),
    );
    await expect(
      loadFromFirebase(portal.roomId, portal.roomKey, portal.socket),
    ).resolves.toEqual([]);
  });

  it("revision 冲突后重新读取并重试", async () => {
    const responses = [
      Response.json({
        revision: 1,
        sceneVersion: 0,
        ciphertext: encodedEmptyScene,
        iv: encodedIV,
        updatedAt: "2026-08-16T00:00:00Z",
      }),
      new Response("conflict", { status: 409 }),
      Response.json({
        revision: 2,
        sceneVersion: 0,
        ciphertext: encodedEmptyScene,
        iv: encodedIV,
        updatedAt: "2026-08-16T00:00:01Z",
      }),
      Response.json({
        revision: 3,
        sceneVersion: 0,
        ciphertext: encodedEmptyScene,
        iv: encodedIV,
        updatedAt: "2026-08-16T00:00:02Z",
      }),
    ];
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => responses.shift()!,
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveToFirebase(createPortal(), [], {} as any),
    ).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      JSON.parse(String(fetchMock.mock.calls[3][1]?.body)).expectedRevision,
    ).toBe(2);
  });
});
