# Knowledge DApp UI

基于 Next.js 16、React 19、Wagmi 与 RainbowKit 构建的知识协作 DApp 前端。项目围绕本地 KnowChain 网络运行，提供内容上链、质押投票、DAO 治理、Treasury 奖励领取，以及链上系统概览等功能。

## 项目简介

这个项目是一个面向本地联盟链场景的知识内容治理前端，核心流程包括：

- 用户连接钱包并切换到 KnowChain
- 上传文件到本地 IPFS
- 将内容 CID 和元数据登记到 `KnowledgeContent` 合约
- 通过 `NativeVotes` 质押原生币并激活投票权
- 对内容投票、触发奖励记账、领取 Treasury 奖励
- 通过 `KnowledgeGovernor + TimelockController` 发起和执行治理提案

## 当前功能模块

### 1. Dashboard

- 展示钱包连接状态和网络状态
- 展示当前账户投票权、待领取奖励
- 展示内容总数和 Treasury 周期预算

### 2. Stake

- 向 `NativeVotes` 合约存入原生币
- 激活已存入的质押以获得投票权
- 发起退出申请
- 冷却期后执行提现

### 3. Content

- 先通过钱包签名完成上传身份认证
- 将文件上传到本地 IPFS
- 调用 `registerContent` 将内容登记上链
- 浏览内容列表、搜索内容、查看内容详情
- 对内容调用 `vote`
- 对内容调用 `distributeReward`

### 4. Rewards

- 查询当前账户待领取奖励
- 查看当前 Treasury 周期预算和已发放金额
- 调用 `claim` 领取奖励

### 5. Governance

- 查询提案门槛、投票延迟、投票周期
- 发起针对 `KnowledgeContent.setRewardRules(...)` 的治理提案
- 浏览提案列表和投票结果
- 对提案进行投票、排队、执行
- 查看单个提案详情

### 6. System

- 查看核心合约地址
- 查看合约 owner / treasury / votesContract 等链上信息
- 查看 Timelock 延迟、Treasury 预算等系统参数

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
- Redis（可选，用于上传认证 nonce 存储）

## 项目结构

```text
src/
  app/
    page.tsx                  # Dashboard
    stake/page.tsx            # 质押与投票权
    content/page.tsx          # 内容上传与列表
    content/[id]/page.tsx     # 内容详情
    rewards/page.tsx          # 奖励领取
    governance/page.tsx       # 治理中心
    governance/[id]/page.tsx  # 提案详情
    system/page.tsx           # 系统概览
    api/
      auth/                   # 上传鉴权
      ipfs/upload/            # 本地 IPFS 上传
  contracts/                  # ABI 与部署地址
  components/                 # 通用 UI 组件
  hooks/                      # 钱包与上传认证逻辑
  lib/                        # 链配置、认证、工具函数
```

## 本地开发要求

启动这个前端前，建议先确保以下服务可用：

- 本地 Besu / EVM RPC：默认 `http://127.0.0.1:8545`
- Chainlens 区块浏览器：默认 `http://127.0.0.1:8181`
- 本地 IPFS Kubo API：默认 `http://127.0.0.1:5001`
- 本地 IPFS Gateway：默认 `http://127.0.0.1:8080/ipfs`
- Redis：可选；如果未配置 `REDIS_URL`，上传认证 nonce 会退回到内存存储

## 安装依赖

```bash
npm install
```

## 环境变量

项目当前依赖以下环境变量。建议创建 `.env.local`：

```env
NEXT_PUBLIC_BESU_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_BESU_CHAIN_ID=20260
NEXT_PUBLIC_CHAINLENS_URL=http://127.0.0.1:8181
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

UPLOAD_PROVIDER=local
IPFS_API_URL=http://127.0.0.1:5001
IPFS_GATEWAY_URL=http://127.0.0.1:8080/ipfs
NEXT_PUBLIC_IPFS_GATEWAY_URL=http://127.0.0.1:8080/ipfs

UPLOAD_AUTH_SECRET=replace_with_a_long_random_secret
UPLOAD_AUTH_NONCE_TTL_SECONDS=300
UPLOAD_AUTH_SESSION_TTL_SECONDS=86400

# 可选
REDIS_URL=redis://localhost:6379
```

### 环境变量说明

- `NEXT_PUBLIC_BESU_RPC_URL`：前端连接的钱包 RPC 地址
- `NEXT_PUBLIC_BESU_CHAIN_ID`：KnowChain 链 ID，当前项目为 `20260`
- `NEXT_PUBLIC_CHAINLENS_URL`：浏览器地址
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`：RainbowKit / WalletConnect 项目 ID
- `UPLOAD_PROVIDER`：当前仅支持 `local`
- `IPFS_API_URL`：服务端上传文件时调用的 Kubo API 地址
- `IPFS_GATEWAY_URL`：服务端返回给前端的网关地址
- `NEXT_PUBLIC_IPFS_GATEWAY_URL`：前端查看内容详情时使用的网关地址
- `UPLOAD_AUTH_SECRET`：上传会话 Cookie 签名密钥
- `UPLOAD_AUTH_NONCE_TTL_SECONDS`：上传签名挑战有效期
- `UPLOAD_AUTH_SESSION_TTL_SECONDS`：上传认证会话有效期
- `REDIS_URL`：可选；用于多实例或更稳定的 nonce 存储

## 启动项目

开发环境：

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

## 当前链与合约配置

当前仓库中的部署配置来自 `src/contracts/deployment.json`：

- Network: `consortium`
- Chain ID: `20260`
- NativeVotes: `0xf913CC093f66D705936f3c8376eF4CDaAD970a42`
- KnowledgeContent: `0xd68fbD1ce33ed4A71Dc48780D377Be0466735b04`
- TreasuryNative: `0x1f95175342cf3d46031bbCE29a339AfD8335db99`
- TimelockController: `0xd0de0912991896691E3671157A2adada5B102aFB`
- KnowledgeGovernor: `0x5f1F054903776a5025806Fc4FEeB0b0e55799A68`

## 上传认证说明

为避免任何钱包都能直接调用上传接口，项目对 `/api/ipfs/upload` 做了签名认证保护：

1. 前端请求 `/api/auth/nonce`
2. 用户使用钱包签名认证消息
3. 服务端通过 `/api/auth/verify` 校验签名
4. 校验通过后写入上传会话 Cookie
5. 前端才能继续调用 `/api/ipfs/upload`

这套流程主要用于“上传文件到本地 IPFS”这一操作，不影响普通链上读写。

## 可用脚本

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## 说明

- 这是一个面向本地链开发环境的前端，不是通用公网部署模板
- README 中的配置说明已按当前仓库实现整理，不再是默认的 Next.js 模板说明
