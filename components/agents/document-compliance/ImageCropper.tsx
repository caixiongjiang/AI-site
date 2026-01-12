"use client";

import { useState, useRef, useEffect, MouseEvent } from "react";
import { Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageCropperProps {
  imageUrl: string;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ImageCropper = ({
  imageUrl,
  onCrop,
  onCancel,
}: ImageCropperProps) => {
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      if (imageRef.current) {
        imageRef.current.src = imageUrl;
      }
    };
  }, [imageUrl]);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPoint({ x, y });
    setIsDragging(true);
    setCropArea({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !startPoint || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const width = currentX - startPoint.x;
    const height = currentY - startPoint.y;

    setCropArea({
      x: width > 0 ? startPoint.x : currentX,
      y: height > 0 ? startPoint.y : currentY,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setCropArea(null);
    setStartPoint(null);
  };

  const handleConfirm = async () => {
    if (!cropArea || !imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 获取实际图片尺寸和显示尺寸的比例
    const displayWidth = imageRef.current.width;
    const displayHeight = imageRef.current.height;
    const scaleX = imageSize.width / displayWidth;
    const scaleY = imageSize.height / displayHeight;

    // 计算实际裁剪区域
    const actualX = cropArea.x * scaleX;
    const actualY = cropArea.y * scaleY;
    const actualWidth = cropArea.width * scaleX;
    const actualHeight = cropArea.height * scaleY;

    // 设置画布尺寸
    canvas.width = actualWidth;
    canvas.height = actualHeight;

    // 绘制裁剪区域
    ctx.drawImage(
      imageRef.current,
      actualX,
      actualY,
      actualWidth,
      actualHeight,
      0,
      0,
      actualWidth,
      actualHeight
    );

    // 转换为 Blob
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File(
          [blob],
          `cropped-${Date.now()}.png`,
          { type: "image/png" }
        );
        onCrop(file);
        // 裁剪完成后聚焦回主页面
        window.focus();
      }
    }, "image/png");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative flex h-full w-full max-w-6xl flex-col p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-dark-card p-4">
          <div>
            <h3 className="text-lg font-medium text-foreground">
              框选截图区域
            </h3>
            <p className="mt-1 text-sm text-muted">
              按住鼠标左键拖拽选择要截取的区域
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-card px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-dark-card/80"
            >
              <RotateCcw className="h-4 w-4" />
              重置
            </button>
            <button
              onClick={() => {
                onCancel();
                // 取消时也聚焦回主页面
                window.focus();
              }}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition-all hover:bg-red-500/20"
            >
              <X className="h-4 w-4" />
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!cropArea || cropArea.width < 10 || cropArea.height < 10}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all",
                cropArea && cropArea.width >= 10 && cropArea.height >= 10
                  ? "bg-primary hover:bg-primary-light"
                  : "cursor-not-allowed bg-dark-border"
              )}
            >
              <Check className="h-4 w-4" />
              确认裁剪
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="flex-1 overflow-auto rounded-lg bg-dark-card p-4">
          <div
            ref={containerRef}
            className="relative inline-block cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Screenshot"
              className="max-w-full"
              draggable={false}
            />

            {/* Crop Overlay */}
            {cropArea && (
              <>
                {/* Dark overlay */}
                <div className="pointer-events-none absolute inset-0 bg-black/50" />

                {/* Crop area */}
                <div
                  className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                  style={{
                    left: cropArea.x,
                    top: cropArea.y,
                    width: cropArea.width,
                    height: cropArea.height,
                  }}
                >
                  {/* Corner markers */}
                  <div className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-primary" />
                  <div className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-primary" />
                  <div className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-primary" />
                  <div className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-primary" />

                  {/* Size label */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-primary px-2 py-1 text-xs font-medium text-white">
                    {Math.round(cropArea.width)} × {Math.round(cropArea.height)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex gap-4 text-xs text-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span>拖拽鼠标选择区域</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>点击&quot;确认裁剪&quot;保存</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span>点击&quot;重置&quot;重新选择</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2">
            <p className="text-xs text-blue-500">
              💡 提示：操作完成后会自动返回主页面
            </p>
          </div>
        </div>

        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
