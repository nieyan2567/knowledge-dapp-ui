/**
 * @notice 服务端请求来源解析工具。
 * @dev 从反向代理头或 Next 请求对象中恢复当前请求的域名与源站地址。
 */
import "server-only";

import type { NextRequest } from "next/server";

/**
 * @notice 解析当前请求对应的站点信息。
 * @param req 当前进入服务端路由的 Next 请求对象。
 * @returns 包含域名和完整 origin 的对象。
 */
export function getRequestSite(req: NextRequest) {
  const domain =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.nextUrl.host;
  const protocol =
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl.protocol.replace(":", "");
  const origin = `${protocol}://${domain}`;

  return { domain, origin };
}
