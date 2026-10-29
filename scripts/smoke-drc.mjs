import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Actual MCP stdio + WebSocket + extension engine, with simulated editor APIs.
// This does not install the extension, connect to EasyEDA or modify a real PCB.
const root = path.resolve(import.meta.dirname, '..');
const runtimeRoot = process.env.EASYEDA_MCP_SMOKE_ROOT ? path.resolve(process.env.EASYEDA_MCP_SMOKE_ROOT) : root;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'easyeda-drc-smoke-'));
const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(runtimeRoot, 'dist/index.js')], cwd: runtimeRoot,
  env: { EASYEDA_MCP_WS_HOST: '127.0.0.1', EASYEDA_MCP_WS_PORT: '0' }, stderr: 'pipe' });
const client = new Client({ name: 'drc-smoke', version: '1' });
let socket;
let diagnostics = '';
transport.stderr?.on('data', chunk => { diagnostics += chunk.toString(); });
try {
  await build({ entryPoints: [path.join(root, 'extension/src/drcRules.ts')], outfile: path.join(temp, 'engine.mjs'), bundle: true, platform: 'node', format: 'esm' });
  const { DrcRules } = await import(pathToFileURL(path.join(temp, 'engine.mjs')).href);
  let current = { name: 'Test', config: { simulatedRule: 10 } };
  let writes = 0;
  const engine = new DrcRules(() => ({
    dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ documentType: 3, uuid: 'pcb', parentProjectUuid: 'project', tabId: 'pcb@project' }) },
    pcb_Drc: {
      getCurrentRuleConfiguration: async () => structuredClone(current),
      overwriteCurrentRuleConfiguration: async config => { writes++; await new Promise(resolve => setTimeout(resolve, 250)); current = { ...current, config }; return true; }
    }
  }));
  await client.connect(transport);
  const names = (await client.listTools()).tools.map(tool => tool.name);
  for (const name of ['easyeda_get_drc_rules', 'easyeda_prepare_drc_edit', 'easyeda_get_drc_edit_result']) assert(names.includes(name));
  const doctor = await client.callTool({ name: 'easyeda_doctor', arguments: {} });
  const expectedVersion = JSON.parse(await fs.readFile(path.join(runtimeRoot, 'package.json'), 'utf8')).version;
  assert.equal(client.getServerVersion()?.version, expectedVersion);
  assert.equal(doctor.structuredContent.doctor.server.version, expectedVersion);
  const endpoint = doctor.structuredContent.doctor.bridge.endpoint;
  assert.match(endpoint, /^ws:\/\/127\.0\.0\.1:\d+$/);
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  socket.on('message', async raw => {
    const call = JSON.parse(raw.toString());
    try {
      const p = call.params ?? {};
      const result = call.method === 'getDrcRules' ? await engine.read(p)
        : call.method === 'prepareDrcEdit' ? await engine.prepare(p)
        : call.method === 'getDrcEditResult' ? engine.result(p)
        : call.method === 'confirmedAction' && p.action === 'editDrcRules' ? await engine.apply(p.params, p.confirmation)
        : undefined;
      socket.send(JSON.stringify({ kind: 'result', requestId: call.requestId, result }));
    } catch (error) { socket.send(JSON.stringify({ kind: 'error', requestId: call.requestId, error: { code: error.code ?? 'simulated_error', message: error.message } })); }
  });
  socket.send(JSON.stringify({ kind: 'hello', client: 'easyeda-pro-extension', version: 'simulated', protocolVersion: '0.1.0', capabilities: {}, status: {} }));
  const read = await client.callTool({ name: 'easyeda_get_drc_rules', arguments: { scope: 'current' } });
  assert.equal(read.structuredContent.result.data.config.simulatedRule, 10);
  const preview = await client.callTool({ name: 'easyeda_prepare_drc_edit', arguments: { operation: { type: 'updateCurrentConfiguration', config: { simulatedRule: 20 } } } });
  assert.equal(writes, 0);
  const edit = preview.structuredContent.result;
  const blocked = await client.callTool({ name: 'easyeda_confirmed_action', arguments: { action: 'editDrcRules', confirmation: 'confirmo', params: { editId: edit.editId } } });
  assert(blocked.isError); assert.equal(writes, 0);
  const unknown = await client.callTool({ name: 'easyeda_confirmed_action', arguments: { action: 'editDrcRules', confirmation: edit.confirmation, params: { editId: edit.editId }, timeoutMs: 50 } });
  assert.equal(unknown.structuredContent.error, 'drc_edit_outcome_unknown');
  assert.equal(unknown.structuredContent.retryable, false);
  const running = await client.callTool({ name: 'easyeda_get_drc_edit_result', arguments: { editId: edit.editId } });
  assert.equal(running.structuredContent.result.status, 'running');
  await new Promise(resolve => setTimeout(resolve, 300));
  const result = await client.callTool({ name: 'easyeda_get_drc_edit_result', arguments: { editId: edit.editId } });
  assert.equal(result.structuredContent.result.status, 'applied');
  assert.equal(current.config.simulatedRule, 20);
  const duplicate = await client.callTool({ name: 'easyeda_confirmed_action', arguments: { action: 'editDrcRules', confirmation: edit.confirmation, params: { editId: edit.editId } } });
  assert.equal(duplicate.structuredContent.error, 'edit_already_started');
  assert.equal(writes, 1);
  assert.match(diagnostics, /WebSocket bridge listening/);
  console.log(JSON.stringify({ passed: true, transport: 'stdio + WebSocket', toolCount: names.length,
    checks: ['catalog', 'native JSON read', 'preview without writing', 'exact confirmation', 'timeout outcome unknown', 'query running/applied', 'no duplicate dispatch', 'stderr diagnostics'] }, null, 2));
} finally {
  socket?.close();
  await client.close();
  await transport.close();
  await fs.rm(temp, { recursive: true, force: true });
}
