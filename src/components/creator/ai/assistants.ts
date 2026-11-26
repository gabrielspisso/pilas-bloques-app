export type Assistant = { id: string, name: string, install: string, register: (server: string) => string }

// Install commands as in the official documentation of each assistant (November 2026).
export const ASSISTANTS: Assistant[] = [
    {
        id: 'opencode', name: 'opencode',
        install: 'brew install anomalyco/tap/opencode-v2',
        register: server => `opencode mcp add --global pilas-bloques -- node ${server}`
    },
    {
        id: 'claude', name: 'Claude Code',
        install: 'npm install -g @anthropic-ai/claude-code@latest',
        register: server => `claude mcp add --scope user pilas-bloques -- node ${server}`
    },
    {
        id: 'codex', name: 'Codex',
        install: 'npm install -g @openai/codex',
        register: server => `codex mcp add pilas-bloques -- node ${server}`
    }
]

/** The app can't know where the teacher downloaded the server. */
export const DEFAULT_MCP_FOLDER = '/ruta/a/pilas-bloques-mcp'

/** A path as one argument of the terminal. */
const argument = (path: string) => /^[\w@%+=:,./~-]*$/.test(path) ? path : `'${path.replace(/'/g, `'\\''`)}'`

export const commandsFor = (assistant: Assistant, folder: string) => {
    const base = folder.trim().replace(/\/+$/, '') || DEFAULT_MCP_FOLDER
    return {
        install: assistant.install,
        build: `cd ${argument(base)} && npm install && npm run build`,
        register: assistant.register(argument(`${base}/dist/src/index.js`))
    }
}
