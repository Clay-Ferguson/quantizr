package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

// #ai-model (WARNING: These values are in a Python file too (quanta_ai.py))
// Encapsulates a specific AI service including a specific service and model
public enum AIModel {
    NONE("[null]", null, null, null, null, false, 0), //
    
    OPENAI("openAi", "openai", "gpt-4o", "OpenAI: ChatGPT-4o", "OAI", true, 128_000), //
    OPENAI_MINI("openAiMini", "openai", "gpt-4o-mini", "OpenAI: ChatGPT-4o Mini", "OAM", true, 128_000), //
    
    PPLX_CHAT("pplxAi", "perplexity", "llama-3.1-sonar-large-128k-chat", "Perplexity: Basic", "PPB", true, 127_000), //
    PPLX_ONLINE("pplxAi_online",  "perplexity", "llama-3.1-sonar-huge-128k-online", "Perplexity: Recent News Aware", "PPN", false, 127_000), //
    PPLX_LLAMA3("llama3",  "perplexity", "llama-3.1-70b-instruct", "Meta: Llama 3", "PPL", true, 131_000), //
    
    ANTH("anthAi",  "anthropic", "claude-3-opus-20240229", "Anthropic: Claude 3 Opus", "ACL", true, 200_000), // Opus (most powerful)
    ANTH_SONNET("anthAi_sonnet",  "anthropic", "claude-3-5-sonnet-20240620", "Anthropic: Claude 3.5 Sonnet", "ACS", true, 200_000), // Sonnet
    
    GEMINI("geminiAi",  "gemini", "gemini-1.5-pro", "Google: Gemini 1.5 Pro", "GEM", true, 2_000_000), //
    GEMINI_FLASH("geminiFlashAi",  "gemini", "gemini-1.5-flash", "Google: Gemini 1.5 Flash", "GFL", true, 1_000_000);

    @JsonValue
    private final String value;
    
    private final String description;
    private final String service;
    private final String model;
    private final String costCode;
    private final boolean allowSystemPrompt;
    private final int contextLength;

    private AIModel(String value, String service, String model, String description, String costCode, boolean allowSystemPrompt, int contextLength) {
        this.value = value;
        this.service = service;
        this.model = model;
        this.description = description;
        this.costCode = costCode;
        this.allowSystemPrompt = allowSystemPrompt;
        this.contextLength = contextLength;
    }

    public static AIModel fromString(String name) {
        if (name == null) {
            return null;
        }
        for (AIModel e : values()) {
            if (e.value.equalsIgnoreCase(name)) {
                return e;
            }
        }
        return null;
    }

    public String getDescription() {
        return description;
    }

    public String getService() {
        return service;
    }

    public String getModel() {
        return model;
    }

    public String getCostCode() {
        return costCode;
    }

    public int getContextLength() {
        return contextLength;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }

    public boolean isAllowSystemPrompt() {
        return allowSystemPrompt;
    }
}
