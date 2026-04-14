# Knowledge DApp UI

基于 Next.js 16、React 19、Wagmi 和 RainbowKit 的联盟链知识协作应用前端。

当前版本面向本地或测试环境中的 Besu / EVM 网络，主要覆盖内容上链、质押投票、治理提案、奖励领取、Faucet 和系统概览等能力。

## 功能范围

- Dashboard：展示钱包、投票权、奖励和 Treasury 摘要
- Stake：质押原生代币、激活投票权、发起退出和提取
- Content：上传内容到本地 IPFS，并登记到链上
- Rewards：查看待领取奖励、奖励来源和领取历史
- Governance：发起提案、投票、排队和执行
- Faucet：为新钱包发放启动资金
- System：查看核心合约和运行参数

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Wagmi
- RainbowKit
- Viem
- TanStack Query
- Redis
- Zod
- Vitest
- Playwright

## 项目结构

```text
src/
  app/
    api/                    # Next Route Handlers
    content/                # 内容上传与详情
    faucet/                 # Faucet
    governance/             # 治理
    profile/                # 账户资料
    rewards/                # 奖励中心
    stake/                  # 质押与投票权
    system/                 # 系统概览
  components/               # 页面组件与通用 UI
  contracts/                # ABI 与部署地址
  hooks/                    # 链交互、自动刷新、鉴权 hooks
  lib/                      # 配置、鉴权、链交互、工具函数
  server/                   # 服务端逻辑
e2e/                        # Playwright 用例
infra/                      # 辅助模板与基础设施示例
scripts/                    # 辅助脚本
```

## 本地依赖

建议先准备这些服务：

- Besu / EVM RPC：`http://127.0.0.1:8545`
- Blockscout：`http://127.0.0.1:8182`
- IPFS Kubo API：`http://127.0.0.1:5001`
- IPFS Gateway：`http://127.0.0.1:8080/ipfs`
- Redis：用于上传鉴权、限流和 Faucet

## 安装与启动

安装依赖：

```bash
npm install
```

复制环境变量模板：

```bash
cp .env.example .env.local
```

启动开发环境：

```bash
npm run dev
```

默认访问：

```text
http://localhost:3000
```

生产构建：

```bash
npm run build
npm run start
```

## 环境变量

项目提供 [.env.example](./.env.example) 作为模板。以下是当前最关键的配置项。

### 链与钱包

- `NEXT_PUBLIC_BESU_RPC_URL`：前端读取链上数据的 RPC 地址
- `NEXT_PUBLIC_BESU_CHAIN_ID`：链 ID，默认 `20260`
- `NEXT_PUBLIC_BLOCKSCOUT_URL`：浏览器地址
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`：WalletConnect 项目 ID

### 上传与 IPFS

- `UPLOAD_PROVIDER`
- `IPFS_API_URL`
- `IPFS_GATEWAY_URL`
- `NEXT_PUBLIC_IPFS_GATEWAY_URL`
- `UPLOAD_AUTH_SECRET`
- `UPLOAD_MAX_FILE_SIZE_BYTES`

### Redis 与限流

- `REDIS_URL`
- `API_RATE_LIMIT_WINDOW_SECONDS`
- `API_RATE_LIMIT_MAX`

### Faucet 与系统维护

- `FAUCET_AUTH_SIGNER_PRIVATE_KEY`
- `FAUCET_RELAYER_PRIVATE_KEY`
- `FAUCET_TOP_UP_FUNDER_PRIVATE_KEY`
- `SYSTEM_API_TOKEN`
- `REBALANCE_API_TOKEN`

## 测试

单元测试与路由测试：

```bash
npm run test:run
```

监听模式：

```bash
npm run test
```

端到端测试：

```bash
npm run test:e2e
```

显示浏览器运行 E2E：

```bash
npm run test:e2e:headed
```

完整检查：

```bash
npm run check
```

## E2E 说明

- Playwright 会在本地启动一个独立的 Next.js 开发服务
- 当前 E2E 主要覆盖导航和断开钱包场景
- 测试中的链 RPC 请求通过本地 mock 处理，不依赖真实链节点

## Faucet Maintenance

生产环境建议定时调用：

- `POST /api/system/faucet/maintenance`

它会检查 relayer 余额，并在需要时自动补充 gas。

示例：

```bash
curl --fail --show-error --silent \
  -X POST "https://your-domain.com/api/system/faucet/maintenance" \
  -H "Authorization: Bearer YOUR_SYSTEM_API_TOKEN"
```

## 常见问题

### 1. 钱包已连接，但页面仍然无法读取链上数据

优先检查：

- `NEXT_PUBLIC_BESU_RPC_URL` 是否可访问
- `NEXT_PUBLIC_BESU_CHAIN_ID` 是否与当前链一致
- 浏览器钱包是否已切换到正确网络

### 2. 内容上传失败

优先检查：

- `IPFS_API_URL` 是否可访问
- `UPLOAD_AUTH_SECRET` 是否已配置
- 上传文件大小是否超过 `UPLOAD_MAX_FILE_SIZE_BYTES`

### 3. Faucet 领取失败

优先检查：

- Faucet 私钥是否已配置
- relayer 账户是否有足够 gas
- Redis 是否可用
- 当前地址是否命中了冷却时间限制

## 当前已知待完善项

- E2E 还没有完全覆盖质押、治理、内容上传和奖励领取全链路
- 生产部署说明仍可继续补充，例如反向代理、进程托管和备份策略
- 真实链环境下的长期运行监控与告警能力仍可继续完善
