"use client";

/**
 * /skills — 技能管理页面
 *
 * 集市列表始终在底层；点击卡片弹出放大预览，创建/编辑仍走独立编辑器。
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchSkills,
  fetchSkillDetail,
  createSkill,
  updateSkill,
  setSkillEnabled,
  deleteSkill,
  uploadSkillCover,
  deleteSkillCover,
  type SkillDescriptor,
  type SkillDetail,
} from "@/lib/api/skills";
import type { SkillEditorSavePayload } from "@/components/skills/SkillEditor";
import { SkillList } from "@/components/skills/SkillList";
import { SkillDetail as SkillDetailComponent } from "@/components/skills/SkillDetail";
import { SkillEditor } from "@/components/skills/SkillEditor";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";

type View = "list" | "create" | "edit";

export default function SkillsPage() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<View>("list");
  const [skills, setSkills] = useState<SkillDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // 加载技能列表。silent 用于启停后刷新，避免整页骨架闪一下。
  const loadSkills = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchSkills();
      setSkills(data);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "加载技能列表失败，请确认 skill-service 已启动";
      setLoadError(message);
      console.error("加载技能列表失败:", e);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadSkills();
  }, [loadSkills, isAuthenticated]);

  // 查看详情：列表不卸载，弹出放大卡片预览
  const handleView = useCallback(async (name: string) => {
    setCurrentName(name);
    setPreviewOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await fetchSkillDetail(name);
      setDetail(data);
    } catch (e) {
      console.error("加载技能详情失败:", e);
      setPreviewOpen(false);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 启停：先改本地状态，再静默对齐服务端，避免整表卸载闪烁
  const handleToggle = useCallback(
    async (name: string, enabled: boolean) => {
      setSkills((prev) =>
        prev.map((s) => (s.name === name ? { ...s, enabled } : s))
      );
      try {
        await setSkillEnabled(name, enabled);
        await loadSkills({ silent: true });
      } catch (e) {
        setSkills((prev) =>
          prev.map((s) => (s.name === name ? { ...s, enabled: !enabled } : s))
        );
        console.error("启停失败:", e);
      }
    },
    [loadSkills]
  );

  // 删除
  const handleDelete = useCallback(
    async (name: string) => {
      try {
        await deleteSkill(name);
        await loadSkills({ silent: true });
      } catch (e) {
        console.error("删除失败:", e);
      }
    },
    [loadSkills]
  );

  // 创建
  const handleCreate = useCallback(() => {
    setCurrentName(null);
    setView("create");
  }, []);

  // 编辑
  const handleEdit = useCallback((name: string) => {
    setCurrentName(name);
    setPreviewOpen(false);
    setView("edit");
  }, []);

  // 保存（创建或编辑）
  const handleSave = useCallback(
    async ({ body, coverFile, removeCover }: SkillEditorSavePayload) => {
      const saved =
        view === "edit" && currentName
          ? await updateSkill(currentName, body)
          : await createSkill(body);

      if (coverFile) {
        await uploadSkillCover(saved.name, coverFile);
      } else if (removeCover) {
        await deleteSkillCover(saved.name);
      }

      setView("list");
      await loadSkills();
    },
    [view, currentName, loadSkills]
  );

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
    setDetail(null);
    setCurrentName(null);
  }, []);

  // 返回列表（关闭编辑器）
  const handleBack = useCallback(() => {
    setView("list");
    setPreviewOpen(false);
    setDetail(null);
    setCurrentName(null);
  }, []);

  return (
    <RequireAuth
      featureLabel="技能"
      title="登录以管理你的技能"
      description="技能的创建、编辑与启停都需要绑定到你的账号，登录后才能安全保存并供知识库调用。"
      nextPath="/skills"
    >
      <div className="min-h-screen bg-gray-50">
      {loadError ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}
      {view !== "create" && view !== "edit" ? (
        <SkillList
          skills={skills}
          loading={loading}
          onView={handleView}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onCreate={handleCreate}
        />
      ) : null}

      {previewOpen ? (
        <SkillDetailComponent
          skill={detail}
          loading={detailLoading}
          onBack={handleClosePreview}
          onEdit={detail?.descriptor.deletable ? handleEdit : undefined}
        />
      ) : null}

      {view === "create" && (
        <SkillEditor onSave={handleSave} onCancel={handleBack} />
      )}

      {view === "edit" && detail && (
        <SkillEditor
          editName={currentName ?? undefined}
          initialBody={detail.body}
          initialCoverUrl={detail.descriptor.cover_url}
          onSave={handleSave}
          onCancel={handleBack}
        />
      )}
      </div>
    </RequireAuth>
  );
}
