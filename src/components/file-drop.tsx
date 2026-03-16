"use client";

import { UploadCloud, FileText } from "lucide-react";
import { useRef, useState } from "react";
import clsx from "clsx";

export function FileDrop({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleOpen() {
    inputRef.current?.click();
  }

  function handleFiles(files: FileList | null) {
    const selected = files?.[0];
    if (selected) onChange(selected);
  }

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
          ? "border-slate-900 bg-slate-100"
          : "border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50"
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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <FileText className="h-6 w-6" />
          </div>
          <div className="text-sm font-medium text-slate-900">{file.name}</div>
          <div className="text-xs text-slate-500">
            {(file.size / 1024).toFixed(1)} KB
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div className="text-sm font-medium text-slate-900">
            点击或拖拽文件到这里上传
          </div>
          <div className="text-xs text-slate-500">
            支持 PDF / TXT / MD 等知识内容文件
          </div>
        </div>
      )}
    </div>
  );
}