"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

const templatePath = "infra/besu-join-node";

const installDockerCommand = `sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \\
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \\
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \\
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`;

const prepareFilesCommand = `cp .env.example .env
mkdir -p network data
# 把联盟管理员提供的 genesis.json 放到 network/genesis.json`;

const generateKeyCommand = `mkdir -p data
openssl rand -hex 32 > data/key
chmod 600 data/key`;

const startNodeCommand = `docker compose up -d
docker compose ps
docker compose logs --tail=100 besu-node`;

const inspectNodeCommand = `./scripts/get-enode.sh
curl -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
curl -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}'`;

export function NodeOnboardingPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-8 overflow-x-hidden px-6 py-10">
      <PageHeader
        eyebrow="Admin / Node Access"
        title="Node Onboarding"
        description="这是一条面向首次接入用户的自建节点接入流程。你不需要先理解 Besu 内部机制，只需要按步骤准备服务器、复制模板、启动节点，再回到申请页提交信息。"
        right={
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/admin/node-onboarding/template"
              className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              下载模板 Zip
            </a>
            <Link
              href="/admin/nodes"
              className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              返回节点申请
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.60fr)_minmax(0,0.40fr)]">
        <div className="min-w-0 space-y-6">
          <SectionCard
            title="你需要先准备什么"
            description="如果下面这些条件还没有满足，请先准备好，否则你无法以自建方式加入网络。"
            bodyClassName="space-y-4"
          >
            <ChecklistItem>一台 Linux 服务器，推荐 Ubuntu 22.04。</ChecklistItem>
            <ChecklistItem>这台服务器的公网 IP 或可访问域名。</ChecklistItem>
            <ChecklistItem>服务器上可以安装 Docker 与 Docker Compose。</ChecklistItem>
            <ChecklistItem>联盟管理员提供的 `genesis.json` 与 `bootnode enode`。</ChecklistItem>
            <ChecklistItem>一个你自己控制的钱包地址，用来作为节点负责人地址。</ChecklistItem>
          </SectionCard>

          <SectionCard
            title="首次接入步骤"
            description="按顺序完成，不要跳步。"
            className="min-w-0"
            bodyClassName="space-y-4"
          >
            <div className="space-y-4">
              <StepCard
                step="Step 1"
                title="准备服务器与开放端口"
                description="购买或准备一台 Linux 云服务器。至少开放 `30303/tcp` 与 `30303/udp`；如果你希望平台后端检查运行状态，再额外开放 `8545` 给受控来源访问。"
              />
              <StepCard
                step="Step 2"
                title="安装 Docker"
                description="在服务器上安装 Docker 与 Docker Compose 插件。不会装时，直接按照 Ubuntu 官方安装文档执行即可。"
                command={installDockerCommand}
              />
              <StepCard
                step="Step 3"
                title="复制仓库里的 join-node 模板"
                description={`模板目录已经放在项目里的 \`${templatePath}\`。把这一整套文件复制到你的服务器工作目录中，例如 \`~/besu-join-node\`。如果你不想手动复制，直接点击本页右上角的“下载模板 Zip”。`}
              />
              <StepCard
                step="Step 4"
                title="填写环境变量与网络文件"
                description="把 `.env.example` 复制成 `.env`，然后填写服务器公网 IP、bootnode enode 等参数。再把管理员提供的 `genesis.json` 放到 `network/genesis.json`。"
                command={prepareFilesCommand}
              />
              <StepCard
                step="Step 5"
                title="生成节点私钥"
                description="模板不会自动替你生成节点身份。你需要先创建一份 Besu 节点私钥文件，保存在 `data/key`。"
                command={generateKeyCommand}
              />
              <StepCard
                step="Step 6"
                title="启动节点"
                description="在模板目录中启动 Docker Compose。第一次启动会下载 Besu 镜像并初始化数据目录。"
                command={startNodeCommand}
              />
              <StepCard
                step="Step 7"
                title="获取 enode 与检查状态"
                description="启动后先获取 enode，再确认节点已经开始连入网络。如果你填写了 `NODE_HOST`，脚本会直接输出可提交的 enode。"
                command={inspectNodeCommand}
              />
              <StepCard
                step="Step 8"
                title="回到平台提交节点申请"
                description="把下面这些信息填回节点申请页：节点名称、服务器地址、节点 RPC 地址（可选但推荐）、enode、说明。审批通过后你的 enode 会被加入 allowlist。"
              />
            </div>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-6">
          <SectionCard
            title="模板文件说明"
            description="右侧模板区和自查区会保持同列显示，方便你边看步骤边对照文件。"
            bodyClassName="space-y-3"
          >
            <PathCard
              path={`${templatePath}/docker-compose.yml`}
              desc="最小可用的 Besu join-node 容器编排。"
            />
            <PathCard
              path={`${templatePath}/.env.example`}
              desc="需要填写的环境变量模板。"
            />
            <PathCard
              path={`${templatePath}/README.md`}
              desc="从零开始的操作说明。"
            />
            <PathCard
              path={`${templatePath}/network/README.md`}
              desc="告诉你 `genesis.json` 应该放在哪里。"
            />
            <PathCard
              path={`${templatePath}/scripts/get-enode.sh`}
              desc="Linux/WSL 下输出 enode 的脚本。"
            />
            <PathCard
              path={`${templatePath}/scripts/get-enode.ps1`}
              desc="PowerShell 下输出 enode 的脚本。"
            />
          </SectionCard>

          <SectionCard
            title="提交前自查"
            description="只要下面任一项不满足，就先不要提交申请。"
            bodyClassName="space-y-4"
          >
            <ChecklistItem>节点容器已成功启动，没有持续报错或反复重启。</ChecklistItem>
            <ChecklistItem>
              你已经拿到可提交的完整 enode，不是占位值，也不是 `127.0.0.1`。
            </ChecklistItem>
            <ChecklistItem>
              如果你填写节点 RPC 地址，平台后端能够从自身网络访问到它。
            </ChecklistItem>
            <ChecklistItem>
              节点至少已经开始连接 peer，或者明确知道当前为什么还没连上。
            </ChecklistItem>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}

function StepCard({
  step,
  title,
  description,
  command,
}: {
  step: string;
  title: string;
  description: string;
  command?: string;
}) {
  return (
    <article className="min-w-0 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {step}
      </div>
      <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
        {description}
      </p>
      {command ? <CommandCard command={command} className="mt-4" /> : null}
    </article>
  );
}

function CommandCard({
  command,
  className,
}: {
  command: string;
  className?: string;
}) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      toast.success("命令已复制");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  return (
    <div
      className={`group max-w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <pre className="min-w-0 flex-1 overflow-x-auto text-xs text-slate-700 dark:text-slate-200">
          <code>{command}</code>
        </pre>
        <button
          type="button"
          title="复制命令"
          aria-label="复制命令"
          onClick={() => void handleCopy()}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 opacity-0 transition hover:bg-slate-50 hover:text-slate-900 group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-950 dark:hover:text-slate-100"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="size-4"
            aria-hidden="true"
          >
            <rect x="7" y="3" width="10" height="12" rx="2" />
            <path d="M5 7H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ChecklistItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-200">
      <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-slate-900 text-xs text-white dark:bg-slate-100 dark:text-slate-900">
        ✓
      </span>
      <div>{children}</div>
    </div>
  );
}

function PathCard({ path, desc }: { path: string; desc: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/30">
      <div
        title={path}
        className="truncate font-mono text-sm text-slate-900 dark:text-slate-100"
      >
        {path}
      </div>
      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{desc}</div>
    </div>
  );
}
