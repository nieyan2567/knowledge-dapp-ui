"use client";

/**
 * 模块说明：主题切换按钮组件，负责在浅色和深色主题之间切换并处理客户端挂载前占位态。
 */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useIsClient } from "@/hooks/useIsClient";

/**
 * 渲染主题切换按钮。
 * @returns 一个在客户端可切换主题的按钮；挂载前显示禁用占位态。
 */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const isClient = useIsClient();

  /*
   * 主题状态依赖客户端环境，服务端阶段无法拿到最终主题，
   * 因此先渲染禁用态按钮，避免首屏出现主题闪烁。
   */
  if (!isClient || !resolvedTheme) {
    return (
      <button
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="切换主题"
        title="加载主题..." 
        disabled
      >
        <Sun className="h-4 w-4 opacity-50" /> 
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label="切换主题"
      title={isDark ? "切换到浅色模式" : "切换到深色模式"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
