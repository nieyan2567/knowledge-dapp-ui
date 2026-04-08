# Besu Join-Node Template

This folder is a minimal self-hosted Besu node template for new operators who want to join the consortium as a normal node.

## What you need first

1. A Linux server, preferably Ubuntu 22.04.
2. Docker and Docker Compose.
3. A public IP address or domain name for the node.
4. `genesis.json` from the network administrator.
5. A bootnode enode from the network administrator.

## Quick start

1. Copy this folder to your server.

2. Create the network and data directories.

```bash
mkdir -p network data
```

3. Copy `.env.example` to `.env` and update:

- `NODE_HOST`
- `BOOTNODE_ENODE`
- optionally `RPC_HTTP_PORT` and `P2P_PORT`

```bash
cp .env.example .env
```

4. Put the consortium `genesis.json` into `network/genesis.json`.

5. Generate a Besu node private key:

```bash
openssl rand -hex 32 > data/key
chmod 600 data/key
```

6. Start the node:

```bash
docker compose up -d
docker compose ps
docker compose logs --tail=100 besu-node
```

7. Print the node enode:

```bash
./scripts/get-enode.sh
```

If you work in PowerShell:

```powershell
.\scripts\get-enode.ps1
```

8. Check whether the node has started to join the network:

```bash
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
```

9. Submit the node request in the application:

- `节点名称`: any human-readable label
- `服务器地址`: your `NODE_HOST`
- `节点 RPC 地址`: optional, for example `http://<NODE_HOST>:8545`
- `Enode`: the output from `get-enode.sh`
- `说明`: region, role, operator notes

## Notes

- Do not submit `127.0.0.1` as the node host in production.
- Do not expose `8545` to the whole internet. Restrict it to trusted IPs if possible.
- This template is for a normal node, not for joining the validator set.
