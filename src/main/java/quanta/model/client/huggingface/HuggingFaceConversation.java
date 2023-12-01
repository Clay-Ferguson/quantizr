package quanta.model.client.huggingface;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

public class HuggingFaceConversation {
    @JsonProperty("generated_responses")
    private List<String> generatedResponses;

    @JsonProperty("past_user_inputs")
    private List<String> pastUserInputs;

    public HuggingFaceConversation() {}

    public List<String> getGeneratedResponses() {
        return generatedResponses;
    }

    public void setGeneratedResponses(List<String> generatedResponses) {
        this.generatedResponses = generatedResponses;
    }

    public List<String> getPastUserInputs() {
        return pastUserInputs;
    }

    public void setPastUserInputs(List<String> pastUserInputs) {
        this.pastUserInputs = pastUserInputs;
    }
}
