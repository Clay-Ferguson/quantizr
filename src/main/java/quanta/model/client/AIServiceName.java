package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum AIServiceName {
    OPENAI("openAi"), //
    PPLX("pplxAi"), //
    PPLX_ONLINE("pplxAi_online"), //
    PPLX_CODE_LLAMA("pplxAi_codeLlama"), //
    PPLX_MIXTRAL("pplxAi_mixtral"), //
    HUGGING_FACE("huggingFace"), //
    OOBA("oobAi"), //
    GEMINI("geminiAi");

    @JsonValue
    private final String value;

    private AIServiceName(String value) {
        this.value = value;
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

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}
