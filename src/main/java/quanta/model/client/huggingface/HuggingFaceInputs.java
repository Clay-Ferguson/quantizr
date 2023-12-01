package quanta.model.client.huggingface;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

public class HuggingFaceInputs {
    private String text;

    @JsonProperty("past_user_inputs")
    private List<String> pastUserInputs;

    @JsonProperty("generated_responses")
    private List<String> generatedResponses;

    public HuggingFaceInputs() {}

    public HuggingFaceInputs(String text) {
        this.text = text;
    }

    public List<String> getPastUserInputs() {
        return pastUserInputs;
    }

    public void setPastUserInputs(List<String> pastUserInputs) {
        this.pastUserInputs = pastUserInputs;
    }

    public List<String> getGeneratedResponses() {
        return generatedResponses;
    }

    public void setGeneratedResponses(List<String> generatedResponses) {
        this.generatedResponses = generatedResponses;
    }

    public String getText() {
        return text;
    }

    public void setText(String input) {
        this.text = input;
    }
}
