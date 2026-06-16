# Vault Assistant Obsidian Plugin

Query your personal knowledge base directly from Obsidian using semantic search (RAG) powered by vault-assistant.

## Features

- 🔍 **Semantic Search** - Query your vault with natural language
- 💬 **Multiple Query Modes**:
  - **Vault Mode**: Search your personal knowledge base with RAG context
  - **General Mode**: Ask general knowledge questions without vault context
  - **Technical Mode**: Search only technical documentation
- 📎 **Direct File Linking** - Click sources to open notes directly
- ⚙️ **Easy Setup** - Just configure your vault-assistant URL
- 🎯 **Contextual Results** - Shows retrieved context chunks and source files

## Installation

### From Release (Coming Soon)
Download the latest release and extract to your vault's `.obsidian/plugins` directory.

### Manual Installation

1. Clone or download this repository
2. Copy to your vault:
   ```bash
   cp -r vault-assistant-obsidian-plugin ~/.obsidian/plugins/vault-assistant
   ```
3. Reload Obsidian or restart
4. Enable the plugin in Settings > Community plugins

### Build from Source

```bash
npm install
npm run build
# Output will be in main.js and main.css
```

## Setup

1. Open Obsidian Settings
2. Go to Community plugins > Vault Assistant
3. Configure the **API Base URL**:
   - Local: `http://localhost:8765`
   - Remote: `https://vault.example.com` (via Tailscale or similar)
4. Click the search icon in the ribbon or use the command palette

## Usage

### Open Query Dialog

- **Ribbon Icon**: Click the search icon in the left sidebar
- **Command**: `Cmd/Ctrl + P` → "Query your vault"
- **Keyboard Shortcut**: Set in Settings > Hotkeys > "Vault Assistant: Query your vault"

### Query Your Notes

1. Enter your question (e.g., "How do I configure Ollama?")
2. Select query mode:
   - **Vault**: Search your personal knowledge base (RAG) - recommended for most queries
   - **General**: Get answers from general knowledge - good for explanations
   - **Technical**: Search only technical documentation
3. Click "Query"
4. Review the answer and sources
5. Click any source to jump directly to that note

## Query Examples

### Vault Mode (RAG Search)
- "What is my cycling setup?"
- "How do I categorize notes in my vault?"
- "What are my work projects?"

### General Mode
- "What is semantic search?"
- "Explain RAG (Retrieval-Augmented Generation)"
- "How do LLMs work?"

### Technical Mode
- "How do I configure Ollama?"
- "What architecture does vault-assistant use?"

## Configuration

### API Base URL

Where vault-assistant is running:
- **Local** (on same Mac): `http://localhost:8765`
- **Remote** (via Tailscale): `https://vault.example.com`

Make sure vault-assistant is running before querying.

## Architecture

```
Obsidian Plugin
    ↓
HTTP POST /query (JSON)
    ↓
vault-assistant API
    ↓
RAG + Ollama LLM
    ↓
Returns: answer + sources
    ↓
Display in Obsidian modal
```

## Keyboard Shortcuts

Set custom shortcuts in Obsidian:
1. Settings > Hotkeys
2. Search for "Vault Assistant"
3. Click to set your preferred shortcut

Recommended: `Cmd+Shift+V` (macOS) or `Ctrl+Shift+V` (Windows/Linux)

## Troubleshooting

### "Connection error: ...is not reachable"

1. **Check vault-assistant is running**:
   ```bash
   curl http://localhost:8765/health
   ```

2. **Verify API URL in plugin settings**:
   - Local: Should be `http://localhost:8765`
   - Remote: Check your Tailscale IP

3. **Check firewall**:
   - Local: Ollama might need firewall permission
   - Remote: Ensure Tailscale is connected and working

### "Querying vault-assistant..." hangs

1. Check if Ollama models are loaded:
   ```bash
   ollama list
   ```

2. Restart Ollama:
   ```bash
   pkill ollama
   ollama serve  # Start in new terminal
   ```

3. Check vault-assistant logs for errors

### No sources returned

1. Make sure your vault is indexed:
   - Check vault-assistant `/health` endpoint
   - Should show `"index_ready": true`

2. Try querying with more context:
   - Use shorter, more specific questions
   - Try increasing `top_k` in vault-assistant (default 5)

## Development

### Build in Watch Mode
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Debug

1. Open Obsidian Developer Console: `Cmd+Option+I` (macOS)
2. Check the Console tab for errors
3. Check Network tab to see API calls

## API Reference

### POST /query

Query your vault with different modes.

```json
{
  "text": "What is X?",
  "mode": "vault",
  "top_k": 5,
  "context_folder": null
}
```

Response:
```json
{
  "answer": "...",
  "sources": ["Life/Work/Projects/X.md"],
  "mode": "vault",
  "context_used": 3
}
```

## Related Projects

- **vault-assistant** - Backend RAG + LLM system
- **vault-assistant** - 8+ major improvements (parallel processing, caching, etc.)

## License

MIT - See LICENSE file

## Support

- Issues: https://github.com/alexkibler/vault-assistant/issues
- Discussions: https://github.com/alexkibler/vault-assistant/discussions

## Future Features

- [ ] Highlight matched text in sources
- [ ] Save/bookmark query results
- [ ] Query history sidebar
- [ ] Integration with Obsidian's search
- [ ] Support for custom context folders
- [ ] Streaming responses for long answers
