"use client";

/**
 * 模块说明：可复制字段组件，负责展示一段文本并提供复制与外链跳转能力。
 */
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

/**
 * 判断文本是否为可直接访问的 HTTP 链接。
 * @param value 待判断的文本值。
 * @returns 若文本是 HTTP 或 HTTPS 链接则返回 `true`。
 */
function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 渲染带复制按钮的字段块。
 * @param label 字段名称。
 * @param value 字段内容。
 * @returns 可复制的字段展示组件。
 */
export function CopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  /**
   * 把当前字段内容写入剪贴板。
   * @returns 成功时弹出成功提示，失败时弹出错误提示。
   */
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
  }

  /*
   * 如果字段内容本身是 URL，就把它渲染成外链；
   * 否则保持为普通文本，仍然允许用户复制。
   */
  const isLink = isHttpUrl(value);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 break-all text-sm font-medium text-slate-800 dark:text-slate-200">
          {isLink ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 underline-offset-2 hover:underline"
              title={value}
            >
              <span className="break-all">{value}</span>
              <ExternalLink className="h-4 w-4 shrink-0" />
            </a>
          ) : (
            value
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          title="复制"
        >
          <Copy className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </button>
      </div>
    </div>
  );
}
