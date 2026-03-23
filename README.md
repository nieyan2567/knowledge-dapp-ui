# Knowledge DApp UI

基于 Next.js 16、React 19、Wagmi 和 RainbowKit 的知识内容协作 DApp 前端。项目面向本地 KnowChain 网络，提供内容上链、质押投票、治理提案、奖励领取、Faucet 和系统概览等功能。

## 项目概览

当前前端覆盖的主要流程：

- 连接钱包并切换到 KnowChain
- 上传文件到本地 IPFS，并将内容登记到 `KnowledgeContent`
- 通过 `NativeVotes` 质押原生币并激活投票权
- 对内容投票、触发奖励记账、领取 `TreasuryNative` 奖励
- 通过 `KnowledgeGovernor + TimelockController` 发起、投票、排队和执行治理提案
- 通过 Faucet 为新钱包发放启动资金

## 功能模块

### Dashboard

- 展示钱包连接状态和当前网络
- 展示投票权、待领取奖励、内容数量和 Treasury 概览

### Stake

- 质押原生币到 `NativeVotes`
- 激活待生效质押，获取投票权
- 发起退出申请，并在冷却期后提取

### Content

- 通过钱包签名完成上传鉴权
- 上传文件到本地 IPFS
- 调用 `registerContent` 将内容登记上链
- 浏览内容列表、查看详情、投票、发起奖励记账

### Rewards

- 查看当前账户待领取奖励
- 查看奖励历史记录和奖励来源
- 调用 `claim` 领取奖励

### Governance

- 查看提案门槛、投票延迟和投票周期
- 发起针对 `KnowledgeContent.setRewardRules(...)` 的治理提案
- 浏览提案列表、查看详情、投票、排队和执行

### System

- 查看核心合约地址
- 查看 owner、treasury、votesContract、timelock 等关键链上信息

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Wagmi
- RainbowKit
- Viem
- TanStack Query
- Sonner
- Redis
- Zod
- Vitest

## 项目结构

```text
src/
  app/
    page.tsx                  # Dashboard
    faucet/page.tsx           # Faucet
    stake/page.tsx            # 质押与投票权
    content/page.tsx          # 内容上传与列表
    content/[id]/page.tsx     # 内容详情
    rewards/page.tsx          # 奖励中心
    governance/page.tsx       # 治理中心
    governance/[id]/page.tsx  # 提案详情
    system/page.tsx           # 系统概览
    api/
      auth/                   # 上传鉴权
      faucet/                 # Faucet nonce / claim
      ipfs/upload/            # 本地 IPFS 上传
  components/                 # 通用 UI 组件
  contracts/                  # ABI 与部署地址
  hooks/                      # Wagmi / 刷新 / 上传鉴权 hooks
  lib/                        # 链配置、鉴权、Faucet、治理和工具函数
```

## 本地依赖

建议先确保以下服务可用：

- Besu / EVM RPC：`http://127.0.0.1:8545`
- ChainLens：`http://127.0.0.1:8181`
- IPFS Kubo API：`http://127.0.0.1:5001`
- IPFS Gateway：`http://127.0.0.1:8080/ipfs`
- Redis：用于上传鉴权 nonce 和 Faucet 限流

## 安装与启动

安装依赖：

```bash
npm install
```

复制环境变量模板并按需填写：

```bash
cp .env.example .env.local
```

启动开发环境：

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

生产构建：

```bash
npm run build
npm run start
```

## 环境变量

项目提供了 [.env.example](./.env.example) 作为模板。当前主要变量如下：

### 链与钱包

- `NEXT_PUBLIC_BESU_RPC_URL`：前端读取链上数据的 RPC 地址
- `NEXT_PUBLIC_BESU_CHAIN_ID`：当前链 ID，默认 `20260`
- `NEXT_PUBLIC_CHAINLENS_URL`：区块浏览器地址
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`：WalletConnect 项目 ID

### 上传服务

- `UPLOAD_PROVIDER`：当前仅支持 `local`
- `IPFS_API_URL`：服务端调用 Kubo 上传文件时使用的 API 地址
- `IPFS_GATEWAY_URL`：服务端拼接返回的网关地址
- `NEXT_PUBLIC_IPFS_GATEWAY_URL`：前端查看内容时使用的网关地址
- `UPLOAD_AUTH_SECRET`：上传鉴权 session 的签名密钥
- `UPLOAD_AUTH_NONCE_TTL_SECONDS`：上传鉴权 nonce 有效期
- `UPLOAD_AUTH_SESSION_TTL_SECONDS`：上传鉴权 session 有效期

### Redis

- `REDIS_URL`：上传鉴权和 Faucet 限流依赖的 Redis 地址

### Faucet

- `FAUCET_PRIVATE_KEY`：Faucet 发放账户私钥
- `FAUCET_AMOUNT`：每次领取的启动资金数量
- `FAUCET_MIN_BALANCE`：钱包余额达到该阈值后不再允许领取
- `FAUCET_COOLDOWN_HOURS`：领取冷却时间
- `FAUCET_NONCE_TTL_SECONDS`：Faucet 签名 challenge 有效期

## 质量门禁

常用脚本：

```bash
npm run lint
npm run typecheck
npm run test
npm run test:run
npm run check
```

其中：

- `lint`：运行 ESLint
- `typecheck`：运行 TypeScript 类型检查
- `test`：启动 Vitest 监听模式
- `test:run`：执行一次性测试
- `check`：依次执行 lint、typecheck 和 test:run

GitHub Actions 也已接入 CI，会在 push 和 pull request 时自动执行上述质量门禁。

## 当前合约配置

当前仓库里的部署配置来自 `src/contracts/deployment.json`：

- Network: `consortium`
- Chain ID: `20260`
- NativeVotes: `0xf913CC093f66D705936f3c8376eF4CDaAD970a42`
- KnowledgeContent: `0xd68fbD1ce33ed4A71Dc48780D377Be0466735b04`
- TreasuryNative: `0x1f95175342cf3d46031bbCE29a339AfD8335db99`
- TimelockController: `0xd0de0912991896691E3671157A2adada5B102aFB`
- KnowledgeGovernor: `0x5f1F054903776a5025806Fc4FEeB0b0e55799A68`

## 上传鉴权流程

`/api/ipfs/upload` 受签名鉴权保护，基本流程如下：

1. 前端请求 `/api/auth/nonce`
2. 用户使用钱包签名上传鉴权消息
3. 服务端通过 `/api/auth/verify` 校验签名
4. 校验通过后写入上传 session Cookie
5. 前端再调用 `/api/ipfs/upload`

## Faucet 限流说明

Faucet 当前采用“钱包地址 + IP”双限流：

- 同一个钱包不能重复领取
- 同一个来源频繁切换新钱包也会被限制
- 领取前会先做预检，避免先弹签名再失败

## 常见排查

### 页面一直连不上链

- 检查 `NEXT_PUBLIC_BESU_RPC_URL`
- 检查本地链是否启动
- 检查钱包是否切换到正确的 Chain ID

### IPFS 上传失败

- 检查 `IPFS_API_URL` 对应的 Kubo API 是否正常
- 检查 `UPLOAD_AUTH_SECRET` 是否已配置
- 检查 Redis 是否可用

### Faucet 无法领取

- 检查钱包余额是否已经高于 `FAUCET_MIN_BALANCE`
- 检查是否仍在冷却期内
- 检查 Faucet 私钥账户余额是否充足

## 说明

- 这个项目目前主要面向本地链开发环境
- 前端已具备基础质量门禁、API schema 校验和 Faucet 双限流
- 后续仍建议继续补全全局错误监控、事件索引优化和更多测试覆盖
