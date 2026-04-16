"use client";

/**
 * 模块说明：拖拽上传组件，负责统一封装文件点击选择与拖拽选择交互。
 */
import { useRef, useState } from "react";
import clsx from "clsx";
import { FileText, UploadCloud } from "lucide-react";

/**
 * 渲染文件拖拽与点击上传区域。
 * @param file 当前已选择的文件。
 * @param onChange 文件变更时触发的回调。
 * @returns 可复用的文件拖拽上传区域。
 */
export function FileDrop({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  /**
   * 打开系统文件选择器。
   * @returns 无返回值。
   */
  function handleOpen() {
    inputRef.current?.click();
  }

  /**
   * 从原生 FileList 中取出第一份文件并向上抛出。
   * @param files 浏览器文件列表对象。
   * @returns 无返回值。
   */
  function handleFiles(files: FileList | null) {
    const selected = files?.[0];
    if (selected) onChange(selected);
  }

  /*
   * 这里同时兼容点击选择和拖拽放入两种交互，
   * 并用 dragging 状态驱动边框和背景变化，给用户明确反馈。
   */
  return (
    <div
      onClick={handleOpen}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={clsx(
        "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition",
        dragging
          ? "border-slate-900 bg-slate-100 dark:*:border-slate-300 dark:bg-slate-800"
          : "border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {file ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
            <FileText className="h-6 w-6" />
          </div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{file.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {(file.size / 1024).toFixed(1)} KB
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            点击或拖拽文件到这里上传
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            支持常见文档与图片，自动拒绝高风险格式
          </div>
        </div>
      )}
    </div>
  );
}
