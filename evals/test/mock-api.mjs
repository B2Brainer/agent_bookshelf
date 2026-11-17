// Local stand-in for the Anthropic Messages API (streaming), used only by the opt-in CLI
// integration test. It scripts an orchestrator that dispatches the subagent with the task
// verbatim, and a subagent that runs one Bash command and then reports.
import http from 'node:http';

function sse(res, blocks, stopReason) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
  send('message_start', { message: { id: `msg_${Date.now()}_${Math.random()}`, type: 'message', role: 'assistant', model: 'mock', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 1 } } });
  blocks.forEach((b, index) => {
    if (b.type === 'text') {
      send('content_block_start', { index, content_block: { type: 'text', text: '' } });
      send('content_block_delta', { index, delta: { type: 'text_delta', text: b.text } });
    } else {
      send('content_block_start', { index, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      send('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
    }
    send('content_block_stop', { index });
  });
  send('message_delta', { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 20 } });
  send('message_stop', {});
  res.end();
}

// script: { agent, agentMarker, command, report }
export function startMockApi(script) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let j = {};
      try { j = JSON.parse(body); } catch {}
      const system = JSON.stringify(j.system ?? '');
      const history = JSON.stringify(j.messages ?? []);
      const tools = (j.tools ?? []).map((t) => t.name);
      const isSubagent = system.includes(script.agentMarker);
      requests.push({ url: req.url, isSubagent, tools, system: isSubagent ? system : undefined });
      if (!req.url.startsWith('/v1/messages') || req.url.includes('count_tokens')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end('{"input_tokens":1}');
      }
      if (isSubagent) {
        if (!history.includes('toolu_mock_bash')) {
          return sse(res, [{ type: 'tool_use', id: 'toolu_mock_bash', name: 'Bash', input: { command: script.command, description: 'run tests' } }], 'tool_use');
        }
        return sse(res, [{ type: 'text', text: script.report }], 'end_turn');
      }
      const dispatchTool = tools.find((t) => t === 'Agent' || t === 'Task');
      if (dispatchTool && !history.includes('toolu_mock_dispatch')) {
        const task = history.match(/Task:\\n([\s\S]*?)"/)?.[1]?.replace(/\\n/g, '\n');
        return sse(res, [{ type: 'tool_use', id: 'toolu_mock_dispatch', name: dispatchTool, input: { subagent_type: script.agent, description: 'run task', prompt: task } }], 'tool_use');
      }
      return sse(res, [{ type: 'text', text: 'Done.' }], 'end_turn');
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, requests, close: () => server.close() }));
  });
}
