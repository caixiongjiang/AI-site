"use client";

import { LockedFeatureScreen } from "@/components/common/LockedFeatureScreen";

/**
 * /agents — Agent应用中心
 *
 * 当前阶段 Agent 模块整体锁定（敬请期待），登录前后均不可用。
 */
export default function AgentsPage() {
  return <LockedFeatureScreen featureLabel="Agent应用" />;
}
