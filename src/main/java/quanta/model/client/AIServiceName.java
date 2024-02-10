package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum AIServiceName {
    OPENAI("openAi"), //
    PPLX("pplxAi"), //
    PPLX_ONLINE("pplxAi_online"), //
    PPLX_CODE_LLAMA("pplxAi_codeLlama"), //
    PPLX_LLAMA2("pplxAi_llama2"), //
    HUGGING_FACE("huggingFace"), //
    OOBA("oobAi"), //
    GEMINI("geminiAi");

    @JsonValue
    private final String value;

    private AIServiceName(String value) {
        this.value = value;
    }

    public static AIServiceName fromString(String name) {
        for (AIServiceName e : AIServiceName.values()) {
            if (e.value.equalsIgnoreCase(name)) {
                return e;
            }
        }
        throw new IllegalArgumentException("No constant with text " + name + " found");
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}
