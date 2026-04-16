/**
 * 模块说明：页面头部组件，负责统一渲染页面标题、副标题、说明文案和右侧操作区。
 */
import { ReactNode } from "react";

/**
 * 渲染页面统一头部。
 * @param eyebrow 标题上方的小标签文案。
 * @param title 页面主标题。
 * @param description 页面描述文本。
 * @param right 标题区域右侧附加内容。
 * @param testId 用于测试定位标题节点的标识。
 * @returns 可复用的页面头部区域。
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  right,
  testId,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <div className="mb-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {eyebrow}
          </div>
        ) : null}
        <h1
          data-testid={testId}
          className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl dark:text-slate-100"
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
