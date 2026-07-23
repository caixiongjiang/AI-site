"use client";

import { LockedFeatureScreen } from "@/components/common/LockedFeatureScreen";

/**
 * /agents/document-compliance — 文档合规 Agent
 *
 * 当前阶段 Agent 模块整体锁定（敬请期待），登录前后均不可用。
 */
export default function DocumentCompliancePage() {
  return <LockedFeatureScreen featureLabel="文档合规 Agent" />;
}
