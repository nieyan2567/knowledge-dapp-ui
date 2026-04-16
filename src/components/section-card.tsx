/**
 * 模块说明：分区卡片容器组件，负责为页面中的独立功能区提供统一卡片样式和头部结构。
 */
import { ReactNode } from "react";

/**
 * 渲染带标题和内容区的通用分区卡片。
 * @param title 卡片标题。
 * @param description 卡片说明文本。
 * @param headerRight 卡片头部右侧附加内容。
 * @param children 卡片主体内容。
 * @param className 卡片根节点附加样式。
 * @param bodyClassName 卡片内容区附加样式。
 * @returns 可复用的分区卡片容器。
 */
export function SectionCard({
  title,
  description,
  headerRight,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className ?? ""}`}
    >
      <div className="mb-5 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
          {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName ?? ""}`}>{children}</div>
    </section>
  );
}
