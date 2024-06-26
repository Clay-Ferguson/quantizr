package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

// #ai-model
public enum AIServiceName {
    NONE("[null]", null), //
    OPENAI("openAi", "OpenAI: ChatGPT-4o"), //
    PPLX("pplxAi", "Perplexity: Basic"), //
    ANTH("anthAi", "Anthropic: Claude 3 Opus"), // Opus (most powerful)
    ANTH_SONNET("anthAi_sonnet", "Anthropic: Claude 3.5 Sonnet"), // Sonnet
    PPLX_ONLINE("pplxAi_online", "Perplexity: Recent News Aware"), //
    PPLX_LLAMA3("llama3", "Meta: Llama 3"), //
    HUGGING_FACE("huggingFace", "Hugging Face"), //
    OOBA("oobAi", "ooba"), //
    GEMINI("geminiAi", "Google: Gemini");

    @JsonValue
    private final String value;

    private final String description;

    private AIServiceName(String value, String description) {
        this.value = value;
        this.description = description;
    }

    public static AIServiceName fromString(String name) {
        if (name == null) {
            return null;
        }
        for (AIServiceName e : values()) {
            if (e.value.equalsIgnoreCase(name)) {
                return e;
            }
        }
        return null;
    }

    public String getDescription() {
        return description;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}
