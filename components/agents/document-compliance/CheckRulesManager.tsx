"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Edit2, Check, X, Lock, AlertTriangle, CopyPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckRule, CheckField, DEFAULT_CHECK_RULES } from "@/lib/types";

interface CheckRulesManagerProps {
  rules: CheckRule[];
  onRulesChange: (rules: CheckRule[]) => void;
  disabled?: boolean;
}

export const CheckRulesManager = ({
  rules,
  onRulesChange,
  disabled = false,
}: CheckRulesManagerProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CheckRule>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [canEditDefaults, setCanEditDefaults] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ show: boolean; message: string }>({ 
    show: false, 
    message: "" 
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 判断是否为默认规则
  const isDefaultRule = (ruleId: string) => {
    return DEFAULT_CHECK_RULES.some(r => r.id === ruleId);
  };

  // 显示错误对话框
  const showError = (message: string) => {
    setErrorDialog({ show: true, message });
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditForm({
      id: `rule-${Date.now()}`,
      name: "",
      description: "",
      fields: [],
    });
  };

  // 滚动到底部
  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const handleAddField = () => {
    const newField: CheckField = {
      id: `field-${Date.now()}`,
      name: "",
      key: "",
      type: "text",
      required: false,
    };
    setEditForm({
      ...editForm,
      fields: [...(editForm.fields || []), newField],
    });
  };

  const handleUpdateField = (fieldId: string, updates: Partial<CheckField>) => {
    setEditForm({
      ...editForm,
      fields: editForm.fields?.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f
      ),
    });
  };

  const handleRemoveField = (fieldId: string) => {
    setEditForm({
      ...editForm,
      fields: editForm.fields?.filter((f) => f.id !== fieldId),
    });
  };

  const handleDuplicateField = (fieldId: string) => {
    const fieldToDuplicate = editForm.fields?.find((f) => f.id === fieldId);
    if (!fieldToDuplicate) return;

    // 创建一个完全相同的字段副本，但使用新的 ID
    const duplicatedField: CheckField = {
      ...fieldToDuplicate,
      id: `field-${Date.now()}-${Math.random()}`,
    };

    // 找到原字段的位置，在其后插入
    const fieldIndex = editForm.fields?.findIndex((f) => f.id === fieldId);
    if (fieldIndex !== undefined && fieldIndex !== -1) {
      const newFields = [...(editForm.fields || [])];
      newFields.splice(fieldIndex + 1, 0, duplicatedField);
      setEditForm({
        ...editForm,
        fields: newFields,
      });
    }
  };

  const handleSaveNew = () => {
    if (!editForm.name || !editForm.fields || editForm.fields.length === 0) {
      showError("请填写规则名称并至少添加一个字段");
      return;
    }

    // 验证所有字段都有名称和键名
    const invalidFields = editForm.fields.filter((f) => !f.name || !f.key);
    if (invalidFields.length > 0) {
      showError("请填写所有字段的名称和键名");
      return;
    }

    // 验证语义检查类型的字段必须填写检查要求
    const semanticFieldsWithoutRequirement = editForm.fields.filter(
      (f) => f.type === "semantic" && (!f.validation?.semanticRequirement || f.validation.semanticRequirement.trim() === "")
    );
    if (semanticFieldsWithoutRequirement.length > 0) {
      showError("语义检查类型的字段必须填写检查要求描述");
      return;
    }

    const newRule: CheckRule = {
      id: editForm.id!,
      name: editForm.name,
      description: editForm.description,
      fields: editForm.fields,
    };

    onRulesChange([...rules, newRule]);
    setIsAdding(false);
    setEditForm({});
    scrollToBottom(); // 新增后滚动到底部
  };

  const handleEdit = (rule: CheckRule) => {
    setEditingId(rule.id);
    setEditForm(rule);
  };

  const handleSaveEdit = () => {
    if (!editForm.name || !editForm.fields || editForm.fields.length === 0) {
      showError("请填写规则名称并至少添加一个字段");
      return;
    }

    const invalidFields = editForm.fields.filter((f) => !f.name || !f.key);
    if (invalidFields.length > 0) {
      showError("请填写所有字段的名称和键名");
      return;
    }

    // 验证语义检查类型的字段必须填写检查要求
    const semanticFieldsWithoutRequirement = editForm.fields.filter(
      (f) => f.type === "semantic" && (!f.validation?.semanticRequirement || f.validation.semanticRequirement.trim() === "")
    );
    if (semanticFieldsWithoutRequirement.length > 0) {
      showError("语义检查类型的字段必须填写检查要求描述");
      return;
    }

    const updatedRules = rules.map((rule) =>
      rule.id === editingId
        ? {
            id: rule.id,
            name: editForm.name!,
            description: editForm.description,
            fields: editForm.fields!,
          }
        : rule
    );

    onRulesChange(updatedRules);
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (ruleId: string) => {
    onRulesChange(rules.filter((rule) => rule.id !== ruleId));
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditForm({});
  };

  const handleDuplicateRule = (rule: CheckRule) => {
    // 创建完全相同的检查项副本
    const duplicatedRule: CheckRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random()}`,
      name: `${rule.name} (副本)`,
      // 复制所有字段，并为每个字段生成新的 ID
      fields: rule.fields.map((field, index) => ({
        ...field,
        id: `field-${Date.now()}-${index}`,
      })),
    };

    // 清除之前的编辑状态，进入添加模式
    setEditingId(null);
    setIsAdding(true);
    setEditForm(duplicatedRule);
    scrollToBottom(); // 复制后滚动到底部
  };

  const renderFieldForm = (field: CheckField) => (
    <div
      key={field.id}
      className="rounded-lg border border-dark-border bg-dark-card/30 p-3"
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">
              字段名称 *
            </label>
            <input
              type="text"
              value={field.name}
              onChange={(e) =>
                handleUpdateField(field.id, { name: e.target.value })
              }
              placeholder="如: 会议主题"
              className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted">
              字段键名 *
            </label>
            <input
              type="text"
              value={field.key}
              onChange={(e) =>
                handleUpdateField(field.id, { key: e.target.value })
              }
              placeholder="如: topic"
              className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">类型</label>
            <select
              value={field.type}
              onChange={(e) =>
                handleUpdateField(field.id, {
                  type: e.target.value as CheckField["type"],
                })
              }
              className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="text">文本</option>
              <option value="numeric">数值</option>
              <option value="time">时间</option>
              <option value="semantic">语义检查</option>
            </select>
          </div>

          {field.type === "numeric" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">
                  最小值
                </label>
                <input
                  type="number"
                  value={field.validation?.min || ""}
                  onChange={(e) =>
                    handleUpdateField(field.id, {
                      validation: {
                        ...field.validation,
                        min: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="可选"
                  className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted">
                  最大值
                </label>
                <input
                  type="number"
                  value={field.validation?.max || ""}
                  onChange={(e) =>
                    handleUpdateField(field.id, {
                      validation: {
                        ...field.validation,
                        max: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="可选"
                  className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          )}

          {field.type === "semantic" && (
            <div>
              <label className="mb-1 block text-xs text-muted">
                检查要求描述 *
              </label>
              <textarea
                value={field.validation?.semanticRequirement || ""}
                onChange={(e) =>
                  handleUpdateField(field.id, {
                    validation: {
                      ...field.validation,
                      semanticRequirement: e.target.value,
                    },
                  })
                }
                placeholder="描述这个字段需要满足的语义要求，例如：内容应积极正面，无消极情绪"
                rows={3}
                className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) =>
                handleUpdateField(field.id, { required: e.target.checked })
              }
              className="h-4 w-4 rounded border-dark-border bg-dark text-primary focus:ring-2 focus:ring-primary"
            />
            <span className="text-xs text-foreground">必填字段</span>
          </label>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleDuplicateField(field.id)}
              className="rounded p-1.5 text-primary transition-colors hover:bg-primary/10"
              title="创建副本"
            >
              <CopyPlus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleRemoveField(field.id)}
              className="rounded p-1.5 text-red-500 transition-colors hover:bg-red-500/10"
              title="删除此字段"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRuleForm = () => (
    <div className="space-y-4">
      {/* Rule Basic Info */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted">
            检查项名称 *
          </label>
          <input
            type="text"
            value={editForm.name || ""}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="如: 会议基本信息"
            className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted">描述</label>
          <input
            type="text"
            value={editForm.description || ""}
            onChange={(e) =>
              setEditForm({ ...editForm, description: e.target.value })
            }
            placeholder="检查项说明"
            className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">
            检查字段 *
          </label>
          <button
            onClick={handleAddField}
            className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
          >
            <Plus className="h-3 w-3" />
            添加字段
          </button>
        </div>

        {editForm.fields && editForm.fields.length > 0 ? (
          <div className="space-y-2">
            {editForm.fields.map((field) => renderFieldForm(field))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-dark-border bg-dark-card/30 py-8 text-center text-sm text-muted">
            暂无字段，点击&quot;添加字段&quot;按钮创建
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleCancel}
          className="rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-dark-card/80"
        >
          取消
        </button>
        <button
          onClick={isAdding ? handleSaveNew : handleSaveEdit}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-primary-light"
        >
          <Check className="h-3.5 w-3.5" />
          保存
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col rounded-xl border border-dark-border bg-dark-card" style={{ height: '800px' }}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-dark-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">检查项配置</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {rules.length} 项
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!disabled && !isAdding && !editingId && (
              <button
                onClick={handleAdd}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-primary-light"
              >
                <Plus className="h-3.5 w-3.5" />
                添加
              </button>
            )}
          </div>
        </div>

        {/* 修改默认配置开关 */}
        {!disabled && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-foreground">修改默认配置</span>
              <span className="text-xs text-muted">
                (开启后可编辑/删除默认检查项)
              </span>
            </div>
            <div
              onClick={() => setCanEditDefaults(!canEditDefaults)}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors cursor-pointer",
                canEditDefaults ? "bg-amber-500" : "bg-dark-border"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                  canEditDefaults ? "left-4" : "left-0.5"
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content - Scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
            {/* Add Form */}
            {isAdding && (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                {renderRuleForm()}
              </div>
            )}

            {/* Rules List */}
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  "rounded-lg border p-4 transition-all",
                  editingId === rule.id
                    ? "border-primary/30 bg-primary/5"
                    : "border-dark-border bg-dark-card/50"
                )}
              >
                {editingId === rule.id ? (
                  // Edit Mode
                  renderRuleForm()
                ) : (
                  // View Mode
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-foreground">
                            {rule.name}
                          </h4>
                          {isDefaultRule(rule.id) && (
                            <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-500">
                              <Lock className="h-3 w-3" />
                              默认
                            </span>
                          )}
                        </div>
                        {rule.description && (
                          <p className="mt-1 text-xs text-muted">
                            {rule.description}
                          </p>
                        )}
                      </div>

                      {!disabled && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => handleDuplicateRule(rule)}
                            className="rounded p-1.5 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                            title="创建副本"
                          >
                            <CopyPlus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleEdit(rule)}
                            disabled={isDefaultRule(rule.id) && !canEditDefaults}
                            className={cn(
                              "rounded p-1.5 transition-colors",
                              isDefaultRule(rule.id) && !canEditDefaults
                                ? "text-muted/50 cursor-not-allowed"
                                : "text-muted hover:bg-primary/10 hover:text-primary"
                            )}
                            title="编辑此检查项"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            disabled={isDefaultRule(rule.id) && !canEditDefaults}
                            className={cn(
                              "rounded p-1.5 transition-colors",
                              isDefaultRule(rule.id) && !canEditDefaults
                                ? "text-muted/50 cursor-not-allowed"
                                : "text-muted hover:bg-red-500/10 hover:text-red-500"
                            )}
                            title="删除此检查项"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Fields List */}
                    <div className="space-y-2">
                      {rule.fields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center gap-2 rounded bg-dark-card/50 px-3 py-2"
                        >
                          <span className="text-xs text-foreground">
                            {field.name}
                          </span>
                          <span className="text-xs text-muted">
                            ({field.key})
                          </span>
                          {field.required && (
                            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-500">
                              必填
                            </span>
                          )}
                          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                            {field.type}
                          </span>
                          {field.type === "numeric" && field.validation && (
                            <span className="text-xs text-muted">
                              {field.validation.min && `≥${field.validation.min}`}
                              {field.validation.min && field.validation.max && " "}
                              {field.validation.max && `≤${field.validation.max}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {rules.length === 0 && !isAdding && (
              <div className="py-8 text-center text-sm text-muted">
                暂无检查项，点击&quot;添加&quot;按钮创建
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Dialog */}
      {errorDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setErrorDialog({ show: false, message: "" })}
          />
          
          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-yellow-500/30 bg-dark-card p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-yellow-500/10 p-3">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  操作失败
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {errorDialog.message}
                </p>
              </div>
              <button
                onClick={() => setErrorDialog({ show: false, message: "" })}
                className="rounded-lg p-1 text-muted transition-colors hover:bg-dark-border hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setErrorDialog({ show: false, message: "" })}
                className="rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-yellow-600"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
