import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRateProvider } from '@ef/adapter-rates';
import { createDeskHandler, LOOPBACK_HOSTS, RulesSource } from './app';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '../..');
const rulesFile = resolve(process.env.EFL_RULES_FILE ?? resolve(appDir, 'rules/branch-rules.json'));
const dist = resolve(appDir, 'dist');
const port = Number(process.env.EFL_PORT ?? 3101);
// Same computer only until DL-N46 is decided (ADR-029): there is no sign-in and no TLS, so a network address is refused.
const host = process.env.EFL_HOST ?? '127.0.0.1';
if (!LOOPBACK_HOSTS.includes(host)) {
  console.error(`refusing to start: EFL_HOST must be a loopback address (${LOOPBACK_HOSTS.join(', ')}). Serving the branch network is not allowed until DL-N46 is decided.`);
  process.exit(1);
}

const log = (line: string) => console.log(line);
const first = new RulesSource(rulesFile).load();
if ('issues' in first) {
  console.error(`refusing to start: ${rulesFile} is not valid:\n - ${first.issues.join('\n - ')}`);
  process.exit(1);
}

const rates = createRateProvider({ url: process.env.EF_RATE_URL, onError: r => console.warn(`rate feed: ${r}`) });
const handler = createDeskHandler({ rulesFile, rates, staticDir: !process.env.EFL_DEV && existsSync(dist) ? dist : undefined, log });
const server = createServer(handler);
server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.listen(port, host, () => log(`branch desk on http://${host === '::1' ? '[::1]' : host}:${port} (same computer only)`));
