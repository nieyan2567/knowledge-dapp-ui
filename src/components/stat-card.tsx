/**
 * 模块说明：统计卡片组件，负责统一渲染数值类摘要信息和可选图标说明。
 */
import { ReactNode } from "react";
import clsx from "clsx";

/**
 * 渲染统计信息卡片。
 * @param title 指标标题。
 * @param value 指标主值。
 * @param description 指标补充说明。
 * @param icon 右上角图标内容。
 * @param className 根节点附加样式。
 * @param headerClassName 头部容器附加样式。
 * @param titleClassName 标题附加样式。
 * @param valueClassName 数值附加样式。
 * @param descriptionClassName 描述文本附加样式。
 * @returns 可复用的统计展示卡片。
 */
export function StatCard({
  title,
  value,
  description,
  icon,
  className,
  headerClassName,
  titleClassName,
  valueClassName,
  descriptionClassName,
}: {
  title: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  valueClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <div
      className={clsx(
        "group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
        className
      )}
    >
      <div
        className={clsx("mb-4 flex items-start justify-between", headerClassName)}
      >
        <div
          className={clsx(
            "text-sm font-medium text-slate-500 dark:text-slate-400",
            titleClassName
          )}
        >
          {title}
        </div>
        {icon ? (
          <div className="text-slate-400 transition group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
            {icon}
          </div>
        ) : null}
      </div>

      <div
        className={clsx(
          "min-h-10 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100",
          valueClassName
        )}
      >
        {value}
      </div>

      {description ? (
        <div
          className={clsx(
            "mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400",
            descriptionClassName
          )}
        >
          {description}
        </div>
      ) : null}
    </div>
  );
}
