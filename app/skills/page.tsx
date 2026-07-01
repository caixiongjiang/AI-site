"use client";

/**
 * /skills — 技能管理页面
 *
 * 三个视图：list（列表）→ detail（详情）→ editor（创建/编辑）
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchSkills,
  fetchSkillDetail,
  createSkill,
  updateSkill,
  setSkillEnabled,
  deleteSkill,
  type SkillDescriptor,
  type SkillDetail,
} from "@/lib/api/skills";
import { SkillList } from "@/components/skills/SkillList";
import { SkillDetail as SkillDetailComponent } from "@/components/skills/SkillDetail";
import { SkillEditor } from "@/components/skills/SkillEditor";

type View = "list" | "detail" | "create" | "edit";

export default function SkillsPage() {
  const [view, setView] = useState<View>("list");
  const [skills, setSkills] = useState<SkillDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 加载技能列表
  const loadSkills = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  // 查看详情
  const handleView = useCallback(async (name: string) => {
    setCurrentName(name);
    setDetailLoading(true);
    setView("detail");
    try {
      const data = await fetchSkillDetail(name);
      setDetail(data);
    } catch (e) {
      console.error("加载技能详情失败:", e);
      setView("list");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 启停
  const handleToggle = useCallback(
    async (name: string, enabled: boolean) => {
      try {
        await setSkillEnabled(name, enabled);
        await loadSkills();
      } catch (e) {
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
        await loadSkills();
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
    setView("edit");
  }, []);

  // 保存（创建或编辑）
  const handleSave = useCallback(
    async (body: string) => {
      if (view === "edit" && currentName) {
        await updateSkill(currentName, body);
      } else {
        await createSkill(body);
      }
      setView("list");
      await loadSkills();
    },
    [view, currentName, loadSkills]
  );

  // 返回列表
  const handleBack = useCallback(() => {
    setView("list");
    setDetail(null);
    setCurrentName(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {loadError ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}
      {view === "list" && (
        <SkillList
          skills={skills}
          loading={loading}
          onView={handleView}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onCreate={handleCreate}
        />
      )}

      {view === "detail" && detail && !detailLoading && (
        <SkillDetailComponent
          skill={detail}
          onBack={handleBack}
          onEdit={detail.descriptor.deletable ? handleEdit : undefined}
        />
      )}

      {view === "detail" && detailLoading && (
        <div className="flex items-center justify-center py-20 text-muted">
          加载中...
        </div>
      )}

      {view === "create" && (
        <SkillEditor onSave={handleSave} onCancel={handleBack} />
      )}

      {view === "edit" && detail && (
        <SkillEditor
          editName={currentName ?? undefined}
          initialBody={detail.body}
          onSave={handleSave}
          onCancel={handleBack}
        />
      )}
    </div>
  );
}
