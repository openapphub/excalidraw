import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSceneData, uploadSceneThumbnail } from "./scenes";

describe("Scene 二进制写请求", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, thumbnailUrl: "thumb" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("token", "token-a");
    sessionStorage.setItem("excalidraw-scene-lock-client-id", "scene-client-a");
  });

  it.each([
    ["场景数据", () => updateSceneData("scene-a", new ArrayBuffer(1))],
    ["缩略图", () => uploadSceneThumbnail("scene-a", new Blob(["image"]))],
  ])("%s 写入同时携带认证、内容类型和锁客户端 ID", async (_name, write) => {
    await write();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("PUT");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer token-a",
      "Content-Type": "application/octet-stream",
      "X-Scene-Client-ID": "scene-client-a",
    });
  });
});
