$body = @{
  jsonrpc = "2.0"
  method = "admin_nodeInfo"
  params = @()
  id = 1
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8545" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body | ConvertTo-Json -Depth 8
