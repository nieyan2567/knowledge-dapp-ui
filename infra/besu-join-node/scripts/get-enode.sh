#!/usr/bin/env bash
set -euo pipefail

payload='{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}'
response=$(curl -fsS -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d "$payload")
echo "$response"
