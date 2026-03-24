# End-to-End Tests

This project uses Playwright for browser-level end-to-end coverage.

## Run

```bash
npm run test:e2e
```

To watch the browser while debugging:

```bash
npm run test:e2e:headed
```

## Notes

- The Playwright config starts the Next.js dev server on port `3100`.
- Tests use the locally installed Chrome channel.
- Chain RPC calls are mocked in `e2e/support/rpc.ts` so the navigation and disconnected-wallet flows stay deterministic without a live KnowChain node.
