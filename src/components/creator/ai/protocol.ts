// Messages between the challenge creator (browser tab) and the local MCP server, as JSON over WebSocket.
// Identical file in both repos: pilas-bloques-mcp/src/protocol.ts and
// pilas-bloques-app/src/components/creator/ai/protocol.ts
export const PROTOCOL_VERSION = 1
export const DEFAULT_PORT = 47800

export type AppMessage =
  | { type: 'hello', protocol: number, code: string }
  | { type: 'response', id: string, ok: true, result: unknown }
  | { type: 'response', id: string, ok: false, error: { code: string, message: string } }
  | { type: 'bye' }

export type ServerMessage =
  | { type: 'welcome', client: string } // MCP client name, e.g. "claude-code"
  | { type: 'rejected', reason: 'bad_code' | 'busy' | 'protocol' }
  | { type: 'request', id: string, method: Method, params: unknown }

export type Method = 'get_challenge' | 'get_recommended_solution' | 'test_program' | 'propose_changes' | 'get_proposal_status'
