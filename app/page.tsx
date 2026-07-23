"use client";

import { LockedFeatureScreen } from "@/components/common/LockedFeatureScreen";

/**
 * / — 首页
 *
 * 当前阶段首页整体锁定（敬请期待），登录前后均不可用。
 * 登录后引导用户前往「知识库」与「技能」。
 */
export default function HomePage() {
  return <LockedFeatureScreen featureLabel="首页" />;
}
