/*
 * The MCP clients and how to install Heliyos in each, used by the install picker
 * (mcp/install) and the full list (mcp/clients). One list, so the two never disagree.
 */
const CURSOR_LINK =
    "https://cursor.com/install-mcp?name=heliyos&config=eyJ0eXBlIjoic3RkaW8iLCJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBoZWxpeW9zL2hlbGl5b3MtbWNwIl0sImVudiI6eyJIRUxJWU9TX0FQSV9LRVkiOiIke2VudjpIRUxJWU9TX0FQSV9LRVl9In19";
const VSCODE_LINK =
    "https://vscode.dev/redirect/mcp/install?name=heliyos&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22heliyos-api-key%22%2C%22description%22%3A%22Heliyos+API+key+%28Settings+%E2%86%92+API+keys%29%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40heliyos%2Fheliyos-mcp%22%5D%2C%22env%22%3A%7B%22HELIYOS_API_KEY%22%3A%22%24%7Binput%3Aheliyos-api-key%7D%22%7D%7D";

export const MCP_CLIENTS = [
    {
      id: "claude-code",
      name: "Claude Code",
      hint: "Run in terminal",
      logo: "/logos/claude.svg",
      steps: [
        {
          title: "Install the Heliyos plugin",
          text: "It asks for your API key, keeps it in your system's secure credential store, and adds a skill that teaches Claude when to use which tool.",
          code: "claude plugin marketplace add heliyos-ai/heliyos-mcp\nclaude plugin install heliyos@heliyos",
        },
        {
          title: "Or add only the MCP server",
          text: "Replace YOUR_HELIYOS_API_KEY with your key.",
          code: "claude mcp add --transport stdio --env HELIYOS_API_KEY=YOUR_HELIYOS_API_KEY --scope user heliyos -- npx -y @heliyos/heliyos-mcp",
        },
        { title: "Verify", text: "Run /mcp in a Claude Code session, or claude mcp list, and look for heliyos." },
      ],
    },
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      hint: "Edit config",
      logo: "/logos/claude.svg",
      steps: [
        { title: "Open the config file", text: "In Claude Desktop, open Settings → Developer → Edit Config." },
        {
          title: "Add Heliyos to claude_desktop_config.json",
          text: "This file holds the key in plain text, so keep it private.",
          code: '{\n  "mcpServers": {\n    "heliyos": {\n      "command": "npx",\n      "args": ["-y", "@heliyos/heliyos-mcp"],\n      "env": {\n        "HELIYOS_API_KEY": "YOUR_HELIYOS_API_KEY"\n      }\n    }\n  }\n}',
        },
        { title: "Restart Claude Desktop", text: "Heliyos appears in the tools menu of a new chat." },
      ],
    },
    {
      id: "codex",
      name: "Codex",
      hint: "Run in terminal",
      logo: "/logos/openai.svg",
      steps: [
        {
          title: "Add Heliyos to ~/.codex/config.toml",
          text: "env_vars passes HELIYOS_API_KEY from the shell you start Codex in, so export it there, for example in ~/.zshrc.",
          code: '[mcp_servers.heliyos]\ncommand = "npx"\nargs = ["-y", "@heliyos/heliyos-mcp"]\nenv_vars = ["HELIYOS_API_KEY"]\nstartup_timeout_sec = 30\ntool_timeout_sec = 120',
        },
        {
          title: "Or use the CLI",
          text: "Then add tool_timeout_sec = 120 to the table it writes.",
          code: "codex mcp add heliyos --env HELIYOS_API_KEY=YOUR_HELIYOS_API_KEY -- npx -y @heliyos/heliyos-mcp",
        },
      ],
    },
    {
      id: "cursor",
      name: "Cursor",
      hint: "One-click install",
      logo: "/logos/cursor.svg",
      steps: [
        { title: "Add Heliyos to Cursor", text: "Open the install link, then confirm in Cursor.", link: { href: CURSOR_LINK, label: "Add to Cursor" } },
        {
          title: "Or edit ~/.cursor/mcp.json",
          text: "Cursor reads ${env:HELIYOS_API_KEY} from its own environment. Export the variable and start Cursor from that shell.",
          code: '{\n  "mcpServers": {\n    "heliyos": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["-y", "@heliyos/heliyos-mcp"],\n      "env": {\n        "HELIYOS_API_KEY": "${env:HELIYOS_API_KEY}"\n      }\n    }\n  }\n}',
        },
      ],
    },
    {
      id: "vscode",
      name: "VS Code",
      hint: "One-click install",
      logo: "/logos/vscode.svg",
      steps: [
        {
          title: "Install Heliyos in VS Code",
          text: "VS Code asks for your key the first time the server starts and keeps it in its secret storage.",
          link: { href: VSCODE_LINK, label: "Install in VS Code" },
        },
        {
          title: "Or add it to .vscode/mcp.json",
          text: "Use the project file, or your user file from MCP: Open User Configuration.",
          code: '{\n  "inputs": [\n    {\n      "type": "promptString",\n      "id": "heliyos-api-key",\n      "description": "Heliyos API key",\n      "password": true\n    }\n  ],\n  "servers": {\n    "heliyos": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["-y", "@heliyos/heliyos-mcp"],\n      "env": {\n        "HELIYOS_API_KEY": "${input:heliyos-api-key}"\n      }\n    }\n  }\n}',
        },
      ],
    },
    {
      id: "antigravity",
      name: "Antigravity",
      hint: "Edit config",
      logo: "/logos/google.svg",
      steps: [
        { title: "Open the raw MCP config", text: "In the agent panel, open … → MCP Servers → Manage MCP Servers → View raw config, or edit ~/.gemini/config/mcp_config.json." },
        {
          title: "Add Heliyos",
          code: '{\n  "mcpServers": {\n    "heliyos": {\n      "command": "npx",\n      "args": ["-y", "@heliyos/heliyos-mcp"],\n      "env": {\n        "HELIYOS_API_KEY": "YOUR_HELIYOS_API_KEY"\n      }\n    }\n  }\n}',
        },
      ],
    },
    {
      id: "other",
      name: "Any client",
      hint: "stdio",
      logo: "/icons/terminal.svg",
      steps: [
        {
          title: "Run the server over stdio",
          text: "Point your client at this command with the key in its environment.",
          code: "HELIYOS_API_KEY=YOUR_HELIYOS_API_KEY npx -y @heliyos/heliyos-mcp",
        },
        { title: "Plugin manifests", text: "The repository also ships Agent Plugins manifests (plugin.json and mcp.json). In the MCP Registry the server is listed as ai.heliyos/heliyos-mcp." },
      ],
    },
  ];


const FEATURED = ["claude-code", "codex", "cursor", "vscode"];

const ClientSteps = ({ client, copied, onCopy }) => (
  <div className="hy-picker-panel">
    {client.steps.map((s, i) => (
      <div className="hy-picker-step" key={client.id + i}>
        <span className="hy-picker-num">{i + 1}</span>
        <div className="hy-picker-body">
          <p className="hy-picker-title">{s.title}</p>
          {s.text ? <p className="hy-picker-text">{s.text}</p> : null}
          {s.code ? (
            <div className="hy-picker-code">
              <pre>
                <code>{s.code}</code>
              </pre>
              <button type="button" className="hy-picker-copy" onClick={() => onCopy(client.id + i, s.code)}>
                {copied === client.id + i ? "Copied" : "Copy"}
              </button>
            </div>
          ) : null}
          {s.link ? (
            <a className="hy-picker-link" href={s.link.href} target="_blank" rel="noreferrer">
              {s.link.label} →
            </a>
          ) : null}
        </div>
      </div>
    ))}
  </div>
);

const useCopy = () => {
  const [copied, setCopied] = useState(null);
  const onCopy = (key, text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  return [copied, onCopy];
};

/** The four most used clients as tiles, with a link to every install option. */
export const InstallPicker = () => {
  const clients = MCP_CLIENTS.filter((c) => FEATURED.includes(c.id));
  const [active, setActive] = useState(clients[0].id);
  const [copied, onCopy] = useCopy();
  const client = clients.find((c) => c.id === active);
  return (
    <div className="not-prose">
      <div className="hy-picker-head">
        <span>Works with every MCP client. Pick yours.</span>
        <a href="/mcp/clients">See all install options →</a>
      </div>
      <div className="hy-picker">
        <div className="hy-picker-tabs" role="tablist" aria-label="Choose your AI client">
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === active}
              className={"hy-picker-tab" + (c.id === active ? " is-active" : "")}
              onClick={() => setActive(c.id)}
            >
              <span className="hy-picker-logo">
                <img src={c.logo} alt="" />
              </span>
              <span className="hy-picker-label">
                <span className="hy-picker-name">{c.name}</span>
                <span className="hy-picker-hint">{c.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <ClientSteps client={client} copied={copied} onCopy={onCopy} />
      </div>
    </div>
  );
};

/** One client's full instructions, for the all install options page. */
export const ClientGuide = ({ id }) => {
  const client = MCP_CLIENTS.find((c) => c.id === id);
  const [copied, onCopy] = useCopy();
  if (!client) return null;
  return (
    <div className="not-prose hy-picker hy-client">
      <div className="hy-client-head">
        <span className="hy-picker-logo">
          <img src={client.logo} alt="" />
        </span>
        <span className="hy-picker-hint">{client.hint}</span>
      </div>
      <ClientSteps client={client} copied={copied} onCopy={onCopy} />
    </div>
  );
};
