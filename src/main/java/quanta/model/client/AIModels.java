package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

// #ai-model
// Encapsulates a specific AI service including a specific service and model
public enum AIModels {
    NONE("[null]", null, null, null), //
    OPENAI("openAi", "openai", "gpt-4o", "OpenAI: ChatGPT-4o"), //
    OPENAI_MINI("openAiMini", "openai", "gpt-4o-mini", "OpenAI: ChatGPT-4o Mini"), //
    PPLX("pplxAi", "perplexity", "llama-3-sonar-large-32k-chat", "Perplexity: Basic"), //
    PPLX_ONLINE("pplxAi_online",  "perplexity", "llama-3-sonar-large-32k-online", "Perplexity: Recent News Aware"), //
    PPLX_LLAMA3("llama3",  "perplexity", "llama-3-70b-instruct", "Meta: Llama 3"), //
    ANTH("anthAi",  "anthropic", "claude-3-opus-20240229", "Anthropic: Claude 3 Opus"), // Opus (most powerful)
    ANTH_SONNET("anthAi_sonnet",  "anthropic", "claude-3-5-sonnet-20240620", "Anthropic: Claude 3.5 Sonnet"), // Sonnet
    GEMINI("geminiAi",  "gemini", "", "Google: Gemini");

    @JsonValue
    private final String value;
    
    private final String description;
    private final String service;
    private final String model;

    private AIModels(String value, String service, String model, String description) {
        this.value = value;
        this.service = service;
        this.model = model;
        this.description = description;
    }

    public static AIModels fromString(String name) {
        if (name == null) {
            return null;
        }
        for (AIModels e : values()) {
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

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}
