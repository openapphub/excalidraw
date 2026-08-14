import React from "react";

/** 2A：不做独立 Teams，此页占位 */
export const TeamsCollectionsPage: React.FC<{
  workspaceId?: string;
  isAdmin?: boolean;
}> = () => (
  <div style={{ padding: 24 }}>
    <h2>共享工作区</h2>
    <p>本构建不使用独立 Team。请在「成员」页通过邀请链接添加成员；集合在侧栏管理。</p>
  </div>
);

export default TeamsCollectionsPage;
