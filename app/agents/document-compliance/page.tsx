"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Download, Database, Copy, Check, Play, Brain, AlertTriangle, X, RefreshCw, GripVertical, ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import Link from "next/link";
import { MultiFileUploader } from "@/components/agents/document-compliance/MultiFileUploader";
import { CheckRulesManager } from "@/components/agents/document-compliance/CheckRulesManager";
import { ValidationResults } from "@/components/agents/document-compliance/ValidationResults";
import { checkDocument } from "@/lib/api/agents/document-compliance";
import {
  DocumentCheckStatus,
  DocumentCheckResponse,
  UploadedFile,
  CheckRule,
  DEFAULT_CHECK_RULES,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export default function DocumentCompliancePage() {
  const [status, setStatus] = useState<DocumentCheckStatus>("idle");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [checkRules, setCheckRules] = useState<CheckRule[]>(DEFAULT_CHECK_RULES);
  const [saveToKb, setSaveToKb] = useState(false);
  const [useExternalLLM, setUseExternalLLM] = useState(false);
  const [showRiskDialog, setShowRiskDialog] = useState(false);
  const [response, setResponse] = useState<DocumentCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const [llmResponse, setLlmResponse] = useState<string>("");
  const [isLlmStreaming, setIsLlmStreaming] = useState(false);
  const [llmResponseCopied, setLlmResponseCopied] = useState(false);
  
  // 分栏调整相关状态
  const [leftWidth, setLeftWidth] = useState(50); // 默认50%（5:5）
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 语义检查配置展开状态
  const [semanticConfigExpanded, setSemanticConfigExpanded] = useState(false);

  // 处理添加文件（立即开始上传）
  const handleFilesAdd = async (files: File[]) => {
    const newFiles: UploadedFile[] = files.map((file) => {
      const id = `file-${Date.now()}-${Math.random()}`;
      const uploadedFile: UploadedFile = {
        id,
        file,
        status: "pending",
      };

      // 如果是图片，生成预览
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === id ? { ...f, preview: e.target?.result as string } : f
            )
          );
        };
        reader.readAsDataURL(file);
      }

      return uploadedFile;
    });

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    // 立即开始上传
    for (const uploadedFile of newFiles) {
      await uploadFile(uploadedFile);
    }
  };

  // 上传单个文件
  const uploadFile = async (uploadedFile: UploadedFile) => {
    try {
      // 更新状态为上传中
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id ? { ...f, status: "uploading" as const } : f
        )
      );

      // 模拟上传进度
      for (let i = 0; i <= 100; i += 20) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === uploadedFile.id ? { ...f, progress: i } : f))
        );
      }

      // 标记为已完成
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id ? { ...f, status: "completed" as const } : f
        )
      );
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id ? { ...f, status: "error" as const } : f
        )
      );
    }
  };

  // 处理删除文件
  const handleFileRemove = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // 显示 Toast 通知
  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 处理拖拽调整宽度
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  // 监听鼠标移动和释放事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const offsetX = e.clientX - containerRect.left;
      const newLeftWidth = (offsetX / containerRect.width) * 100;

      // 限制宽度范围在 30% - 70% 之间
      if (newLeftWidth >= 30 && newLeftWidth <= 70) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // 处理开始检查
  const handleCheck = async () => {
    if (uploadedFiles.length === 0) {
      showToast("请先上传文件", "warning");
      return;
    }

    // 检查是否所有文件都已上传完成
    const allUploaded = uploadedFiles.every(f => f.status === "completed");
    if (!allUploaded) {
      showToast("请等待文件上传完成", "warning");
      return;
    }

    // 如果开启了外部大模型，显示风险提醒
    if (useExternalLLM) {
      setShowRiskDialog(true);
      return;
    }

    // 执行检查
    await performCheck();
  };

  // 模拟大模型流式输出
  const simulateLLMStream = async (prompt: string) => {
    setIsLlmStreaming(true);
    setLlmResponse("");
    
    // 模拟流式响应的文本
    const mockLLMResponse = `经过对上传文档的详细分析，我发现以下问题：

**必填项检查**
- 会议主持人、记录员、地点等基本信息已填写完整

**时长检查**
- 会议时长为 4.5 小时，超过建议的 4 小时上限，建议确认是否准确

**参会人员**
- 应到人数 10 人，实到人数 8 人
- ⚠️ 缺席原因未填写，建议补充缺席人员及原因

**语义分析**
- 会议记录内容完整，表述清晰
- 决议事项明确，责任人清楚

**改进建议**
1. 补充缺席人员的详细信息和缺席原因
2. 确认会议时长是否准确（4.5小时较长）
3. 建议在会议记录中增加时间节点，方便后续追溯

总体而言，文档符合基本规范要求，但需要补充部分细节信息。`;

    // 逐字输出
    const words = mockLLMResponse.split("");
    for (let i = 0; i < words.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      setLlmResponse((prev) => prev + words[i]);
    }
    
    setIsLlmStreaming(false);
  };

  // 执行检查（从对话框确认后调用）
  const performCheck = async () => {
    setShowRiskDialog(false);

    try {
      setError(null);
      setStatus("parsing");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setStatus("validating");

      // 调用 API（当后端准备好时取消注释）
      // const result = await checkDocument({
      //   file: uploadedFiles[0].file, // 或者发送多个文件
      //   save_to_kb: saveToKb,
      //   mode: "auto_check",
      // });

      // 模拟响应数据（使用自定义检查项）
      const mockRecord = {
        meeting_time_start: "14:00",
        meeting_time_end: "18:30",
        attendees_expected: 10,
        attendees_actual: 8,
        absent_reason: "",
        host: "张三",
        recorder: "李四",
        place: "会议室A",
        meeting_duration: 270, // 4.5小时 = 270分钟
      } as any;

      // 根据检查规则生成验证结果
      const validationResults: any[] = [];

      checkRules.forEach((rule) => {
        rule.fields.forEach((field) => {
          const value = mockRecord[field.key];
          let isValid = true;
          let errorMsg = null;
          let severity: "success" | "warning" | "error" = "success";

          // 必填检查
          if (field.required && (!value || value === "")) {
            isValid = false;
            errorMsg = `${field.name}为必填项，当前为空`;
            severity = "error";
          }
          // 数值检查
          else if (field.type === "numeric" && field.validation) {
            const numValue = Number(value);
            if (field.validation.min && numValue < field.validation.min) {
              isValid = false;
              errorMsg = `${field.name}不得少于 ${field.validation.min}`;
              severity = "error";
            }
            if (field.validation.max && numValue > field.validation.max) {
              isValid = false;
              errorMsg = `${field.name}超过上限 ${field.validation.max}，建议确认`;
              severity = "warning";
            }
          }
          // 特殊逻辑：缺席原因检查
          else if (
            field.key === "absent_reason" &&
            mockRecord.attendees_actual < mockRecord.attendees_expected
          ) {
            if (!value || value === "") {
              isValid = false;
              errorMsg = "实到人数少于应到人数，但未填写缺席原因";
              severity = "error";
            }
          }

          validationResults.push({
            field: field.name,
            is_valid: isValid,
            error_msg: errorMsg,
            original_value: value,
            severity,
          });
        });
      });

      const mockResponse: DocumentCheckResponse = {
        success: true,
        record: {
          meeting_time_start: mockRecord.meeting_time_start,
          meeting_time_end: mockRecord.meeting_time_end,
          attendees_expected: mockRecord.attendees_expected,
          attendees_actual: mockRecord.attendees_actual,
          absent_reason: mockRecord.absent_reason,
          host: mockRecord.host,
          recorder: mockRecord.recorder,
          place: mockRecord.place,
          content_body: "讨论了项目进展...",
        },
        validation_results: validationResults,
        prompt: `你是一个文稿合规检查助手。请检查以下会议记录的合规性：

会议信息：
- 时间：${mockRecord.meeting_time_start} - ${mockRecord.meeting_time_end}
- 主持人：${mockRecord.host}
- 记录员：${mockRecord.recorder}
- 地点：${mockRecord.place}
- 应到人数：${mockRecord.attendees_expected}人
- 实到人数：${mockRecord.attendees_actual}人

当前检查项目：
${checkRules
  .map(
    (r) =>
      `【${r.name}】${r.description ? ` - ${r.description}` : ""}\n${r.fields.map((f) => `  - ${f.name} (${f.key})${f.required ? " [必填]" : ""}`).join("\n")}`
  )
  .join("\n\n")}

请重点检查以上各项的合规性。`,
      };

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setResponse(mockResponse);
      setStatus("completed");

      // 如果开启了外部大模型，执行流式输出
      if (useExternalLLM && mockResponse.prompt) {
        showToast("正在调用 AI 进行深度分析...", "success");
        await simulateLLMStream(mockResponse.prompt);
        showToast("AI 分析完成", "success");
      }
    } catch (err) {
      console.error("Check failed:", err);
      setError(err instanceof Error ? err.message : "检查失败，请重试");
      setStatus("error");
    }
  };

  // 处理复制提示词
  const handleCopyPrompt = async () => {
    if (!response?.prompt) return;

    try {
      await navigator.clipboard.writeText(response.prompt);
      setCopied(true);
      showToast("提示词已复制到剪贴板", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      showToast("复制失败，请手动复制", "error");
    }
  };

  // 处理复制AI分析结果
  const handleCopyLlmResponse = async () => {
    if (!llmResponse) return;

    try {
      await navigator.clipboard.writeText(llmResponse);
      setLlmResponseCopied(true);
      showToast("AI 分析结果已复制到剪贴板", "success");
      setTimeout(() => setLlmResponseCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      showToast("复制失败，请手动复制", "error");
    }
  };

  // 处理重新生成AI分析
  const handleRegenerateLlm = async () => {
    if (!response?.prompt || isLlmStreaming) return;

    try {
      showToast("正在重新生成 AI 分析...", "success");
      await simulateLLMStream(response.prompt);
      showToast("AI 分析已重新生成", "success");
    } catch (err) {
      console.error("Regenerate failed:", err);
      showToast("重新生成失败，请重试", "error");
    }
  };

  // 处理导出报告
  const handleExportReport = () => {
    if (!response) return;

    try {
      let reportText = `文稿合规检查报告
    
检查时间：${new Date().toLocaleString("zh-CN")}
文件数量：${uploadedFiles.length}
检查模式：${useExternalLLM ? "本地规则 + AI 深度分析" : "本地规则"}

=== 会议信息 ===
主持人：${response.record.host || "未填写"}
记录员：${response.record.recorder || "未填写"}
地点：${response.record.place || "未填写"}
时间：${response.record.meeting_time_start || "未填写"} - ${response.record.meeting_time_end || "未填写"}
应到人数：${response.record.attendees_expected || "未填写"}
实到人数：${response.record.attendees_actual || "未填写"}

=== 检查结果 ===
${response.validation_results
  .map(
    (r) =>
      `[${r.is_valid ? "✓" : "✗"}] ${r.field}: ${r.error_msg || "通过"}${r.original_value !== null && r.original_value !== undefined ? ` (原始值: ${r.original_value})` : ""}`
  )
  .join("\n")}

=== 使用的检查规则 ===
${checkRules
  .map(
    (r) =>
      `【${r.name}】${r.description ? ` - ${r.description}` : ""}\n${r.fields.map((f) => `  - ${f.name} (${f.key})${f.required ? " [必填]" : ""}`).join("\n")}`
  )
  .join("\n\n")}
`;

      // 如果开启了外部大模型且有 AI 分析结果，添加到报告中
      if (useExternalLLM && llmResponse) {
        reportText += `\n\n=== AI 深度分析 ===
${llmResponse}
`;
      }

      const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `检查报告_${new Date().getTime()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("报告已成功导出", "success");
    } catch (err) {
      console.error("Export failed:", err);
      showToast("导出失败，请重试", "error");
    }
  };

  const isProcessing = ["parsing", "validating"].includes(status);
  const isUploading = uploadedFiles.some(f => f.status === "uploading");
  const allUploaded = uploadedFiles.every(f => f.status === "completed");
  const hasCheckRules = checkRules.length > 0;
  const canCheck = uploadedFiles.length > 0 && allUploaded && !isProcessing && hasCheckRules;
  
  // 获取所有语义检查字段
  const semanticFields = checkRules.flatMap(rule => 
    rule.fields
      .filter(field => field.type === "semantic")
      .map(field => ({
        ruleName: rule.name,
        ruleDescription: rule.description,
        ...field
      }))
  );
  const hasSemanticFields = semanticFields.length > 0;

  return (
    <div className="min-h-screen bg-dark pb-20">
      {/* Header */}
      <div className="border-b border-dark-border bg-dark-card/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/agents"
                className="rounded-lg p-2 transition-colors hover:bg-dark-card"
              >
                <ArrowLeft className="h-5 w-5 text-muted" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  文稿检查助手
                </h1>
                <p className="mt-1 text-sm text-muted">
                  智能检查会议记录的合规性和完整性 · 支持多文件/截图上传 · 自定义检查项
                </p>
              </div>
            </div>

            {/* Export Button */}
            {status === "completed" && response && (
              <button
                onClick={handleExportReport}
                className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-all hover:bg-primary/20"
                title="导出检查报告"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">导出报告</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8">
        {/* Desktop: Resizable Layout */}
        <div ref={containerRef} className="hidden lg:flex items-start" style={{ gap: '0' }}>
          {/* Left Column - Check Rules & Results */}
          <div 
            className="flex flex-col gap-6"
            style={{ width: `${leftWidth}%`, paddingRight: '12px' }}
          >
            {/* Check Rules Manager */}
            <div>
              <CheckRulesManager
                rules={checkRules}
                onRulesChange={setCheckRules}
                disabled={isProcessing}
              />
            </div>

            {/* Results Section or Waiting State - 这个区域与右侧 AI 分析对齐 */}
            <div>
              {status === "completed" && response ? (
                <ValidationResults results={response.validation_results} />
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dark-border bg-dark-card" style={{ height: '500px' }}>
                  <div className="flex flex-col items-center text-center">
                    <div className="rounded-full bg-primary/10 p-4">
                      <Database className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium text-foreground">
                      等待检查
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      请在右侧上传文档并点击&quot;开始检查&quot;以查看结果
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resizable Divider - 左右间距对称 */}
          <div
            className="group relative flex shrink-0 cursor-col-resize self-stretch"
            style={{ width: '24px', margin: '0 12px' }}
            onMouseDown={handleMouseDown}
          >
            {/* 背景条 */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center justify-center">
              <div className="h-full w-1 rounded-full bg-gradient-to-b from-dark-border via-primary/30 to-dark-border transition-all group-hover:w-1.5 group-hover:from-primary/50 group-hover:via-primary group-hover:to-primary/50" />
            </div>
            {/* 拖拽手柄 */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex h-16 w-8 items-center justify-center rounded-xl bg-dark-card/80 shadow-lg backdrop-blur-sm opacity-0 transition-all group-hover:opacity-100 border border-primary/20">
              <GripVertical className="h-5 w-5 text-primary" />
            </div>
          </div>

          {/* Right Column - Upload & Settings */}
          <div 
            className="flex flex-col gap-6"
            style={{ width: `${100 - leftWidth}%`, paddingLeft: '12px' }}
          >
            {/* 上传和设置区域 - 固定高度800px，与左侧 CheckRulesManager 对齐 */}
            <div className="relative flex flex-col gap-4 rounded-xl border border-dark-border bg-dark-card p-6 overflow-y-auto" style={{ height: '800px' }}>
              {/* File Upload */}
              <div>
                <h2 className="mb-4 text-lg font-medium text-foreground">
                  上传文档或截图
                </h2>
                <MultiFileUploader
                  files={uploadedFiles}
                  onFilesAdd={handleFilesAdd}
                  onFileRemove={handleFileRemove}
                  disabled={isProcessing}
                />
              </div>

              {/* Upload Status */}
              {isUploading && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                  <p className="text-center text-sm text-blue-500">
                    文件上传中，请稍候...
                  </p>
                </div>
              )}

              {/* AI Check Settings */}
              <div className="border-t border-dark-border pt-4">
              <h2 className="mb-4 text-lg font-medium text-foreground">
                AI 检查设置
              </h2>
              <div className="space-y-4">
                <label className="flex cursor-pointer items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        存入知识库
                      </p>
                      <p className="text-xs text-muted">
                        将文档内容保存到知识库
                      </p>
                    </div>
                  </div>
                  <div
                    onClick={() => !isProcessing && setSaveToKb(!saveToKb)}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      saveToKb ? "bg-primary" : "bg-dark-border",
                      isProcessing && "opacity-50"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                        saveToKb ? "left-5" : "left-0.5"
                      )}
                    />
                  </div>
                </label>

                <div className="border-t border-dark-border pt-4">
                  <label className="flex cursor-pointer items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Brain className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          调用外部大模型
                        </p>
                        <p className="text-xs text-muted">
                          使用 AI 进行深度语义检查
                        </p>
                      </div>
                    </div>
                    <div
                      onClick={() => !isProcessing && setUseExternalLLM(!useExternalLLM)}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        useExternalLLM ? "bg-purple-500" : "bg-dark-border",
                        isProcessing && "opacity-50"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                          useExternalLLM ? "left-5" : "left-0.5"
                        )}
                      />
                    </div>
                  </label>
                </div>

                {/* 语义检查配置 - 始终显示，可折叠 */}
                <div className="border-t border-dark-border pt-4">
                  <button
                    onClick={() => setSemanticConfigExpanded(!semanticConfigExpanded)}
                    className="mb-3 flex w-full items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-5 w-5 text-purple-500" />
                      <h3 className="text-sm font-medium text-foreground">
                        语义检查配置
                      </h3>
                      {semanticFields.length > 0 && (
                        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                          {semanticFields.length} 项
                        </span>
                      )}
                    </div>
                    {semanticConfigExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted" />
                    )}
                  </button>
                  
                  {semanticConfigExpanded && (
                    <div className="max-h-[200px] overflow-y-auto">
                      {semanticFields.length > 0 ? (
                        <div className="space-y-2">
                          {semanticFields.map((field, index) => (
                            <div
                              key={`${field.id}-${index}`}
                              className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-foreground">
                                      {field.name}
                                    </span>
                                    {field.required && (
                                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-500">
                                        必填
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-muted">
                                    来自: {field.ruleName}
                                  </p>
                                  {field.validation?.semanticRequirement && (
                                    <p className="mt-2 rounded bg-dark-card/50 px-2 py-1 text-xs text-purple-400">
                                      {field.validation.semanticRequirement}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-muted">
                          暂无语义检查配置
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCheck}
                  disabled={!canCheck}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg py-3 font-medium transition-all",
                    canCheck
                      ? "bg-primary text-white hover:bg-primary-light"
                      : "cursor-not-allowed bg-dark-border text-muted"
                  )}
                >
                  <Play className="h-4 w-4" />
                  {isProcessing ? "检查中..." : isUploading ? "上传中..." : "开始检查"}
                </button>
                
                {/* 提示信息 */}
                {!allUploaded && uploadedFiles.length > 0 && (
                  <p className="text-center text-xs text-muted">
                    等待文件上传完成...
                  </p>
                )}
                {!hasCheckRules && (
                  <p className="text-center text-xs text-yellow-500">
                    请至少配置一个检查项
                  </p>
                )}
                {uploadedFiles.length === 0 && hasCheckRules && (
                  <p className="text-center text-xs text-muted">
                    请先上传文档
                  </p>
                )}
              </div>
              
              {/* Status Info - 进度条固定在设置区域内，不占用额外布局空间 */}
              {isProcessing && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-dark-border">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{
                          width:
                            status === "parsing"
                              ? "50%"
                              : "100%",
                        }}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-center text-sm text-foreground">
                    {status === "parsing" && "解析文档中..."}
                    {status === "validating" && "校验数据中..."}
                  </p>
                </div>
              )}
              </div>
            </div>

            {/* AI 分析区域 - 始终显示 */}
            {useExternalLLM ? (
              /* 大模型流式输出 */
              <div className="flex flex-col rounded-xl border border-purple-500/30 bg-dark-card p-6" style={{ height: '500px' }}>
                <div className="mb-4 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    <h2 className="text-lg font-medium text-foreground">
                      AI 深度分析
                    </h2>
                    {isLlmStreaming && (
                      <span className="flex items-center gap-1 text-xs text-purple-500">
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-purple-500" />
                        分析中...
                      </span>
                    )}
                  </div>
                  
                  {/* 操作按钮 */}
                  {llmResponse && !isLlmStreaming && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyLlmResponse}
                        className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-500 transition-all hover:bg-purple-500/20"
                        title="复制分析结果"
                      >
                        {llmResponseCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            复制
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleRegenerateLlm}
                        className="flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-dark-border"
                        title="重新生成分析"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        重新生成
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto rounded-lg border border-dark-border bg-dark p-4">
                  {llmResponse ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                        {llmResponse}
                      </pre>
                    </div>
                  ) : status === "completed" || isLlmStreaming ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted">
                      等待 AI 响应...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-sm text-muted">
                      完成检查后将显示 AI 深度分析
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* AI Prompt Display */
              <div className="flex flex-col rounded-xl border border-primary/30 bg-dark-card p-6" style={{ height: '500px' }}>
                <div className="mb-4 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Copy className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-medium text-foreground">
                      AI 提示词
                    </h2>
                  </div>
                  
                  {/* Copy Button */}
                  {status === "completed" && response?.prompt && (
                    <button
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20"
                      title="复制提示词"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          复制
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto rounded-lg border border-dark-border bg-dark p-4">
                  {status === "completed" && response?.prompt ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                        {response.prompt}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-sm text-muted">
                      完成检查后将显示 AI 提示词
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Stacked Layout */}
        <div className="flex flex-col gap-6 lg:hidden">
          {/* Left Column Content - Mobile */}
          <div className="space-y-6">
            <CheckRulesManager
              rules={checkRules}
              onRulesChange={setCheckRules}
              disabled={isProcessing || isUploading}
            />

            {status === "completed" && response && (
              <ValidationResults results={response.validation_results} />
            )}

            {status === "idle" && uploadedFiles.length === 0 && (
              <div className="rounded-xl border border-dark-border bg-dark-card p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <Database className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-foreground">
                    等待检查
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    请在下方上传文档并点击&quot;开始检查&quot;以查看结果
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column Content - Mobile */}
          <div className="space-y-6">
            <div className="rounded-xl border border-dark-border bg-dark-card p-6">
              <h2 className="mb-4 text-lg font-medium text-foreground">
                上传文档或截图
              </h2>
              <MultiFileUploader
                files={uploadedFiles}
                onFilesAdd={handleFilesAdd}
                onFileRemove={handleFileRemove}
                disabled={isProcessing}
              />
            </div>

            {isUploading && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                <p className="text-center text-sm text-blue-500">
                  文件上传中，请稍候...
                </p>
              </div>
            )}

            <div className="rounded-xl border border-dark-border bg-dark-card p-6">
              <h2 className="mb-4 text-lg font-medium text-foreground">
                AI 检查设置
              </h2>
              <div className="space-y-4">
                <label className="flex cursor-pointer items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        存入知识库
                      </p>
                      <p className="text-xs text-muted">
                        将文档内容保存到知识库
                      </p>
                    </div>
                  </div>
                  <div
                    onClick={() => !isProcessing && setSaveToKb(!saveToKb)}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      saveToKb ? "bg-primary" : "bg-dark-border",
                      isProcessing && "opacity-50"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                        saveToKb ? "left-5" : "left-0.5"
                      )}
                    />
                  </div>
                </label>

                <div className="border-t border-dark-border pt-4">
                  <label className="flex cursor-pointer items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Brain className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          调用外部大模型
                        </p>
                        <p className="text-xs text-muted">
                          使用 AI 进行深度语义检查
                        </p>
                      </div>
                    </div>
                    <div
                      onClick={() => !isProcessing && setUseExternalLLM(!useExternalLLM)}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        useExternalLLM ? "bg-purple-500" : "bg-dark-border",
                        isProcessing && "opacity-50"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                          useExternalLLM ? "left-5" : "left-0.5"
                        )}
                      />
                    </div>
                  </label>
                </div>

                {hasSemanticFields && (
                  <div className="border-t border-dark-border pt-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      <h3 className="text-sm font-medium text-foreground">
                        语义检查配置
                      </h3>
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                        {semanticFields.length} 项
                      </span>
                    </div>
                    <div className="space-y-2">
                      {semanticFields.map((field, index) => (
                        <div
                          key={`${field.id}-${index}`}
                          className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground">
                                  {field.name}
                                </span>
                                {field.required && (
                                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-500">
                                    必填
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-muted">
                                来自: {field.ruleName}
                              </p>
                              {field.validation?.semanticRequirement && (
                                <p className="mt-2 rounded bg-dark-card/50 px-2 py-1 text-xs text-purple-400">
                                  {field.validation.semanticRequirement}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCheck}
                  disabled={!canCheck}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg py-3 font-medium transition-all",
                    canCheck
                      ? "bg-primary text-white hover:bg-primary-light"
                      : "cursor-not-allowed bg-dark-border text-muted"
                  )}
                >
                  <Play className="h-4 w-4" />
                  {isProcessing ? "检查中..." : isUploading ? "上传中..." : "开始检查"}
                </button>
                
                {!allUploaded && uploadedFiles.length > 0 && (
                  <p className="text-center text-xs text-muted">
                    等待文件上传完成...
                  </p>
                )}
                {!hasCheckRules && (
                  <p className="text-center text-xs text-yellow-500">
                    请至少配置一个检查项
                  </p>
                )}
                {uploadedFiles.length === 0 && hasCheckRules && (
                  <p className="text-center text-xs text-muted">
                    请先上传文档
                  </p>
                )}
              </div>
            </div>

            {isProcessing && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-dark-border">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{
                        width:
                          status === "parsing"
                            ? "50%"
                            : "100%",
                      }}
                    />
                  </div>
                </div>
                <p className="mt-3 text-center text-sm text-foreground">
                  {status === "parsing" && "解析文档中..."}
                  {status === "validating" && "校验数据中..."}
                </p>
              </div>
            )}

            {useExternalLLM && (status === "completed" || isLlmStreaming) && (
              <div className="rounded-xl border border-purple-500/30 bg-dark-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    <h2 className="text-lg font-medium text-foreground">
                      AI 深度分析
                    </h2>
                    {isLlmStreaming && (
                      <span className="flex items-center gap-1 text-xs text-purple-500">
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-purple-500" />
                        分析中...
                      </span>
                    )}
                  </div>
                  
                  {llmResponse && !isLlmStreaming && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyLlmResponse}
                        className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-500 transition-all hover:bg-purple-500/20"
                        title="复制分析结果"
                      >
                        {llmResponseCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            复制
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleRegenerateLlm}
                        className="flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-dark-border"
                        title="重新生成分析"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        重新生成
                      </button>
                    </div>
                  )}
                </div>
                <div className="max-h-[500px] overflow-y-auto rounded-lg border border-dark-border bg-dark p-4">
                  {llmResponse ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                        {llmResponse}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-sm text-muted">
                      等待 AI 响应...
                    </div>
                  )}
                </div>
              </div>
            )}

            {status === "completed" && response && !useExternalLLM && (
              <div className="rounded-xl border border-dark-border bg-dark-card p-6">
                <h2 className="mb-4 text-lg font-medium text-foreground">
                  操作
                </h2>
                <button
                  onClick={handleCopyPrompt}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 py-3 font-medium text-primary transition-all hover:bg-primary/20"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      复制 AI 提示词
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-500">
            {error}
          </div>
        )}
      </div>

      {/* Risk Warning Dialog */}
      {showRiskDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowRiskDialog(false)}
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
                  数据安全提醒
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  开启外部大模型将把文档内容发送至第三方 AI 服务进行分析。
                  <span className="mt-2 block text-yellow-500">
                    请确保您的数据发送给大模型不会涉及数据泄漏风险。
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowRiskDialog(false)}
                className="rounded-lg p-1 text-muted transition-colors hover:bg-dark-border hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowRiskDialog(false)}
                className="flex-1 rounded-lg border border-dark-border bg-dark py-2.5 text-sm font-medium text-foreground transition-all hover:bg-dark-border"
              >
                取消
              </button>
              <button
                onClick={performCheck}
                className="flex-1 rounded-lg bg-yellow-500 py-2.5 text-sm font-medium text-white transition-all hover:bg-yellow-600"
              >
                确认并继续
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-6 py-3 shadow-2xl backdrop-blur-sm",
              toast.type === "success" && "border-green-500/30 bg-green-500/10 text-green-500",
              toast.type === "error" && "border-red-500/30 bg-red-500/10 text-red-500",
              toast.type === "warning" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500"
            )}
          >
            {toast.type === "success" && <Check className="h-5 w-5" />}
            {toast.type === "error" && <X className="h-5 w-5" />}
            {toast.type === "warning" && <AlertTriangle className="h-5 w-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
