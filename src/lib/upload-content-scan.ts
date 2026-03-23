const MAX_TEXT_SCAN_BYTES = 256 * 1024;

type TextScanRule = {
  id: string;
  pattern: RegExp;
  message: string;
};

export type TextScanResult =
  | {
      ok: true;
      scannedText: string;
    }
  | {
      ok: false;
      message: string;
      ruleId: string;
    };

const TEXT_SCAN_RULES: TextScanRule[] = [
  {
    id: "script-tag",
    pattern: /<script\b/i,
    message: "检测到脚本标签，文本内容存在安全风险",
  },
  {
    id: "html-shell",
    pattern: /<!doctype\s+html|<(html|head|body|iframe|object|embed)\b/i,
    message: "检测到 HTML 可执行内容，文本内容存在安全风险",
  },
  {
    id: "svg-tag",
    pattern: /<svg\b/i,
    message: "检测到 SVG 内容，文本内容存在安全风险",
  },
  {
    id: "inline-handler",
    pattern: /\son[a-z]+\s*=/i,
    message: "检测到内联事件脚本，文本内容存在安全风险",
  },
  {
    id: "javascript-uri",
    pattern: /javascript\s*:/i,
    message: "检测到 javascript: 协议，文本内容存在安全风险",
  },
  {
    id: "vbscript-uri",
    pattern: /vbscript\s*:/i,
    message: "检测到 vbscript: 协议，文本内容存在安全风险",
  },
  {
    id: "data-html",
    pattern: /data\s*:\s*text\/html/i,
    message: "检测到 data:text/html 内容，文本内容存在安全风险",
  },
  {
    id: "php-tag",
    pattern: /<\?(php|=)/i,
    message: "检测到 PHP 代码片段，文本内容存在安全风险",
  },
  {
    id: "shell-shebang",
    pattern: /^#!.*\b(bash|sh|zsh|fish)\b/im,
    message: "检测到 Shell 脚本内容，文本内容存在安全风险",
  },
  {
    id: "powershell-shebang",
    pattern: /^#!.*\b(powershell|pwsh)\b/im,
    message: "检测到 PowerShell 脚本内容，文本内容存在安全风险",
  },
  {
    id: "batch-script",
    pattern: /@echo\s+off|\bcmd\.exe\b|\bsetlocal\b/i,
    message: "检测到批处理脚本内容，文本内容存在安全风险",
  },
  {
    id: "powershell-command",
    pattern: /\bpowershell(?:\.exe)?\b|\bstart-process\b|\binvoke-webrequest\b/i,
    message: "检测到 PowerShell 命令，文本内容存在安全风险",
  },
  {
    id: "shell-download",
    pattern: /\b(curl|wget)\s+https?:\/\//i,
    message: "检测到下载执行命令，文本内容存在安全风险",
  },
  {
    id: "destructive-shell",
    pattern: /\brm\s+-rf\b|\bchmod\s+\+x\b/i,
    message: "检测到高风险 Shell 命令，文本内容存在安全风险",
  },
  {
    id: "dangerous-js",
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(|require\((['"])child_process\1\)/i,
    message: "检测到高风险脚本调用，文本内容存在安全风险",
  },
];

function decodeTextSample(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function getTextScanSample(buffer: Buffer) {
  return buffer.subarray(0, Math.min(buffer.length, MAX_TEXT_SCAN_BYTES));
}

export function scanTextContent(buffer: Buffer): TextScanResult {
  const scannedText = decodeTextSample(getTextScanSample(buffer));

  for (const rule of TEXT_SCAN_RULES) {
    if (rule.pattern.test(scannedText)) {
      return {
        ok: false,
        message: rule.message,
        ruleId: rule.id,
      };
    }
  }

  return {
    ok: true,
    scannedText,
  };
}
