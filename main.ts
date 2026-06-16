import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  Modal,
  Notice,
} from "obsidian";

interface VaultAssistantSettings {
  baseUrl: string;
  apiMode: string;
}

const DEFAULT_SETTINGS: VaultAssistantSettings = {
  baseUrl: "http://localhost:8765",
  apiMode: "vault",
};

interface QueryResponse {
  answer: string;
  sources: string[];
  mode: string;
  context_used: number;
}

class VaultAssistantQueryModal extends Modal {
  input: string = "";
  mode: string = "vault";
  baseUrl: string;

  constructor(
    app: App,
    baseUrl: string,
    onSubmit: (query: string, mode: string) => void
  ) {
    super(app);
    this.baseUrl = baseUrl;
    this.onSubmit = onSubmit;
  }

  onSubmit: (query: string, mode: string) => void;

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("vault-assistant-modal");

    contentEl.createEl("h2", { text: "Query Your Vault" });

    // Query input
    const inputContainer = contentEl.createDiv();
    inputContainer.addClass("vault-assistant-input-container");

    const label = inputContainer.createEl("label", {
      text: "Enter your question:",
    });
    label.addClass("vault-assistant-label");

    const input = inputContainer.createEl("textarea", {
      attr: {
        placeholder:
          "What would you like to know about your notes?",
        rows: "4",
      },
    });
    input.addClass("vault-assistant-input");
    this.input = "";

    input.addEventListener("input", (e) => {
      this.input = (e.target as HTMLTextAreaElement).value;
    });

    // Mode selection
    const modeContainer = contentEl.createDiv();
    modeContainer.addClass("vault-assistant-mode-container");

    const modeLabel = modeContainer.createEl("label", { text: "Query Mode:" });
    modeLabel.addClass("vault-assistant-label");

    const modeSelect = modeContainer.createEl("select");
    modeSelect.addClass("vault-assistant-select");

    const modes = [
      { value: "vault", label: "Vault (RAG - your notes)" },
      { value: "general", label: "General (world knowledge)" },
      { value: "technical", label: "Technical (docs only)" },
    ];

    modes.forEach(({ value, label }) => {
      const option = modeSelect.createEl("option", { text: label });
      option.value = value;
      if (value === "vault") option.selected = true;
    });

    modeSelect.addEventListener("change", (e) => {
      this.mode = (e.target as HTMLSelectElement).value;
    });

    // Submit button
    const buttonContainer = contentEl.createDiv();
    buttonContainer.addClass("vault-assistant-button-container");

    const submitBtn = buttonContainer.createEl("button", { text: "Query" });
    submitBtn.addClass("vault-assistant-button");

    submitBtn.addEventListener("click", () => {
      if (this.input.trim()) {
        this.onSubmit(this.input, this.mode);
        this.close();
      } else {
        new Notice("Please enter a question");
      }
    });

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addClass("vault-assistant-button-secondary");
    cancelBtn.addEventListener("click", () => this.close());

    // Focus input on open
    input.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class VaultAssistantResultsModal extends Modal {
  response: QueryResponse;

  constructor(app: App, response: QueryResponse) {
    super(app);
    this.response = response;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("vault-assistant-results-modal");

    // Header
    const header = contentEl.createEl("h2", { text: "Query Result" });
    header.addClass("vault-assistant-results-header");

    // Mode badge
    const modeBadge = contentEl.createEl("span", {
      text: `Mode: ${this.response.mode}`,
    });
    modeBadge.addClass("vault-assistant-mode-badge");

    // Answer
    const answerContainer = contentEl.createDiv();
    answerContainer.addClass("vault-assistant-answer-container");

    const answerLabel = answerContainer.createEl("h3", { text: "Answer" });
    answerLabel.addClass("vault-assistant-section-label");

    const answerEl = answerContainer.createEl("p", {
      text: this.response.answer,
    });
    answerEl.addClass("vault-assistant-answer-text");

    // Sources
    if (this.response.sources.length > 0) {
      const sourcesContainer = contentEl.createDiv();
      sourcesContainer.addClass("vault-assistant-sources-container");

      const sourcesLabel = sourcesContainer.createEl("h3", {
        text: `Sources (${this.response.sources.length})`,
      });
      sourcesLabel.addClass("vault-assistant-section-label");

      const sourcesList = sourcesContainer.createEl("ul");
      sourcesList.addClass("vault-assistant-sources-list");

      this.response.sources.forEach((source) => {
        const item = sourcesList.createEl("li");
        item.addClass("vault-assistant-source-item");

        // Extract note name from path
        const noteName = source.split("/").pop() || source;
        const link = item.createEl("a", { text: noteName });
        link.addClass("vault-assistant-source-link");

        link.addEventListener("click", (e) => {
          e.preventDefault();
          // Open the note in Obsidian
          const file = this.app.metadataCache.getFirstLinkpathDest(
            source.replace(".md", ""),
            ""
          );
          if (file) {
            this.app.workspace.getLeaf().openFile(file);
            this.close();
          } else {
            new Notice(`Could not find file: ${source}`);
          }
        });

        // Tooltip with full path
        link.title = source;
      });

      // Context stats
      const statsEl = sourcesContainer.createEl("small", {
        text: `Retrieved ${this.response.context_used} context chunks`,
      });
      statsEl.addClass("vault-assistant-stats");
    }

    // Close button
    const closeBtn = contentEl.createEl("button", { text: "Close" });
    closeBtn.addClass("vault-assistant-button");
    closeBtn.addEventListener("click", () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default class VaultAssistantPlugin extends Plugin {
  settings: VaultAssistantSettings;

  async onload() {
    await this.loadSettings();

    // Add ribbon icon
    this.addRibbonIcon("search", "Query Vault", () => {
      this.openQueryDialog();
    });

    // Add command to open query dialog
    this.addCommand({
      id: "vault-assistant-query",
      name: "Query your vault",
      callback: () => {
        this.openQueryDialog();
      },
    });

    // Add settings tab
    this.addSettingTab(new VaultAssistantSettingTab(this.app, this));
  }

  openQueryDialog() {
    const modal = new VaultAssistantQueryModal(
      this.app,
      this.settings.baseUrl,
      async (query: string, mode: string) => {
        await this.performQuery(query, mode);
      }
    );
    modal.open();
  }

  async performQuery(query: string, mode: string) {
    try {
      new Notice("Querying vault-assistant...");

      const response = await fetch(`${this.settings.baseUrl}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: query,
          mode: mode,
          top_k: 5,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        new Notice(`Error: ${error.error || "Unknown error"}`);
        return;
      }

      const data: QueryResponse = await response.json();

      // Show results in modal
      const resultsModal = new VaultAssistantResultsModal(this.app, data);
      resultsModal.open();
    } catch (error) {
      console.error("Query error:", error);
      new Notice(
        `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class VaultAssistantSettingTab extends PluginSettingTab {
  plugin: VaultAssistantPlugin;

  constructor(app: App, plugin: VaultAssistantPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Vault Assistant Settings" });

    new Setting(containerEl)
      .setName("API Base URL")
      .setDesc(
        "URL where vault-assistant is running (e.g., http://localhost:8765 or https://vault.example.com)"
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.baseUrl)
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value || DEFAULT_SETTINGS.baseUrl;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Query Modes" });

    const modesInfo = containerEl.createEl("p");
    modesInfo.style.fontSize = "0.9em";
    modesInfo.style.color = "var(--text-muted)";
    modesInfo.createEl("strong", { text: "Vault: " });
    modesInfo.appendText(
      "Search your personal knowledge base with RAG. "
    );
    modesInfo.createEl("br");
    modesInfo.createEl("strong", { text: "General: " });
    modesInfo.appendText(
      "Get general knowledge answers without vault context. "
    );
    modesInfo.createEl("br");
    modesInfo.createEl("strong", { text: "Technical: " });
    modesInfo.appendText(
      "Query only technical documentation from your vault."
    );

    containerEl.createEl("h3", { text: "Keyboard Shortcut" });

    const shortcutInfo = containerEl.createEl("p");
    shortcutInfo.style.fontSize = "0.9em";
    shortcutInfo.style.color = "var(--text-muted)";
    shortcutInfo.appendText(
      "You can set a custom keyboard shortcut in Obsidian Settings > Hotkeys > Vault Assistant > Query your vault"
    );
  }
}
