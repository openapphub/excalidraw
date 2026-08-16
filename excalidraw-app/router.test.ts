import { describe, expect, it } from "vitest";

import { replaceWorkspaceSlugInUrl } from "./router";

describe("replaceWorkspaceSlugInUrl", () => {
  it("重命名 Workspace 时保留 Scene、查询参数和 hash", () => {
    expect(
      replaceWorkspaceSlugInUrl(
        "http://localhost/workspace/source/scene/scene-a?thread=t1&comment=c1#key=secret",
        "source",
        "target",
      ),
    ).toBe("/workspace/target/scene/scene-a?thread=t1&comment=c1#key=secret");
  });

  it("当前 URL 已切到其他 Workspace 时不重写", () => {
    expect(
      replaceWorkspaceSlugInUrl(
        "http://localhost/workspace/other/settings",
        "source",
        "target",
      ),
    ).toBeNull();
  });
});
