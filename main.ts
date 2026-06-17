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
  baseUrl: "http://192.168.1.32:8765",
  apiMode: "vault",
};

interface QueryResponse {
  answer: string;
  sources: string[];
  mode: string;
  context_used: number;
  conversation_id?: string;
}

class VaultAssistantQueryModal extends Modal {
  input: string = "";
  mode: string = "vault";
  baseUrl: string;
  onSubmit: (query: string, mode: string) => void;

  constructor(
    app: App,
    baseUrl: string,
    onSubmit: (query: string, mode: string) => void
  ) {
    super(app);
    this.baseUrl = baseUrl;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Query Your Vault" });

    // Query input
    const inputContainer = contentEl.createDiv();
    const label = inputContainer.createEl("label", {
      text: "Enter your question:",
    });

    const input = inputContainer.createEl("textarea", {
      attr: {
        placeholder: "What would you like to know about your notes?",
        rows: "4",
      },
    });
    this.input = "";

    input.addEventListener("input", (e) => {
      this.input = (e.target as HTMLTextAreaElement).value;
    });

    // Mode selection
    const modeContainer = contentEl.createDiv();
    const modeLabel = modeContainer.createEl("label", { text: "Query Mode:" });

    const modeSelect = modeContainer.createEl("select");

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
    const submitBtn = buttonContainer.createEl("button", { text: "Query" });

    submitBtn.addEventListener("click", () => {
      if (this.input.trim()) {
        this.onSubmit(this.input, this.mode);
        this.close();
      } else {
        new Notice("Please enter a question");
      }
    });

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
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
  query: string;
  baseUrl: string;
  onFollowup?: (followupQuery: string, conversationId: string) => void;

  constructor(
    app: App,
    query: string,
    response: QueryResponse,
    baseUrl: string,
    onFollowup?: (followupQuery: string, conversationId: string) => void
  ) {
    super(app);
    this.query = query;
    this.response = response;
    this.baseUrl = baseUrl;
    this.onFollowup = onFollowup;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("vault-assistant-results-modal");

    // Header with close button
    const headerDiv = contentEl.createDiv("vault-assistant-results-header");
    headerDiv.createEl("h2", { text: "Query Result" });
    const closeBtn = headerDiv.createEl("button", { text: "✕" });
    closeBtn.addClass("vault-assistant-close-btn");
    closeBtn.addEventListener("click", () => this.close());

    // Your query section
    const querySection = contentEl.createDiv("vault-assistant-query-section");
    querySection.createEl("h3", { text: "Your Query" });
    querySection.createEl("p", { text: this.query });

    // Mode and context badges
    const metadata = contentEl.createDiv("vault-assistant-metadata");
    const modeBadge = metadata.createEl("span", { cls: "vault-assistant-badge" });
    modeBadge.setText(`Mode: ${this.response.mode}`);
    const contextBadge = metadata.createEl("span", { cls: "vault-assistant-badge" });
    contextBadge.setText(`Context: ${this.response.context_used} chunks`);

    // Answer section
    const answerContainer = contentEl.createDiv("vault-assistant-answer-section");
    answerContainer.createEl("h3", { text: "Answer" });
    answerContainer.createEl("p", {
      text: this.response.answer,
      cls: "vault-assistant-answer-text",
    });

    // Sources section
    if (this.response.sources.length > 0) {
      const sourcesContainer = contentEl.createDiv("vault-assistant-sources-section");
      sourcesContainer.createEl("h3", {
        text: `Sources (${this.response.sources.length})`,
      });

      const sourcesList = sourcesContainer.createEl("ul", { cls: "vault-assistant-sources-list" });
      this.response.sources.forEach((source) => {
        const item = sourcesList.createEl("li");
        const noteName = source.split("/").pop() || source;
        const link = item.createEl("a", { text: noteName });
        link.addClass("vault-assistant-source-link");
        link.title = source;
      });
    }

    // Follow-up section (if conversation_id available)
    if (this.response.conversation_id) {
      const followupContainer = contentEl.createDiv("vault-assistant-followup-section");
      followupContainer.createEl("h3", { text: "Follow-up Question" });

      const followupInput = followupContainer.createEl("textarea", {
        attr: {
          placeholder: "Ask a follow-up question about the same topic...",
          rows: "3",
        },
        cls: "vault-assistant-followup-input",
      });

      const followupBtn = followupContainer.createEl("button", { text: "Ask Follow-up" });
      followupBtn.addClass("vault-assistant-followup-btn");
      followupBtn.addEventListener("click", () => {
        const followupText = followupInput.value.trim();
        if (followupText && this.onFollowup) {
          this.onFollowup(followupText, this.response.conversation_id!);
          this.close();
        } else if (!followupText) {
          new Notice("Please enter a follow-up question");
        }
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default class VaultAssistantPlugin extends Plugin {
  settings: VaultAssistantSettings;
  currentConversationId?: string;

  async onload() {
    await this.loadSettings();

    // Add ribbon icon
    this.addRibbonIcon("search", "Query Vault", () => {
      this.openQueryDialog();
    });

    // Add command
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

  async performQuery(query: string, mode: string, conversationId?: string) {
    try {
      new Notice("Querying vault-assistant...");

      const requestBody: any = {
        text: query,
        mode: mode,
        top_k: 5,
      };

      // Add conversation context for follow-ups
      if (conversationId) {
        requestBody.conversation_id = conversationId;
        requestBody.is_followup = true;
      }

      const response = await fetch(`${this.settings.baseUrl}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        new Notice(`Error: ${error.error || "Unknown error"}`);
        return;
      }

      const data: QueryResponse = await response.json();

      // Store conversation ID for follow-ups
      if (data.conversation_id) {
        this.currentConversationId = data.conversation_id;
      }

      // Show results in modal with follow-up capability
      const resultsModal = new VaultAssistantResultsModal(
        this.app,
        query,
        data,
        this.settings.baseUrl,
        (followupQuery: string, conversationId: string) => {
          this.performQuery(followupQuery, mode, conversationId);
        }
      );
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
  }
}
