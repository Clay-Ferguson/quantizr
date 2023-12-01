package quanta.model.client.huggingface;

import java.util.LinkedList;

public class HuggingFaceRequest {
    private HuggingFaceInputs inputs;

    public HuggingFaceRequest() {}

    public HuggingFaceRequest(String input) {
        inputs = new HuggingFaceInputs();
        inputs.setText(input);
        inputs.setGeneratedResponses(new LinkedList<String>());
        inputs.setPastUserInputs(new LinkedList<String>());
    }

    public HuggingFaceInputs getInputs() {
        return inputs;
    }

    public void setInputs(HuggingFaceInputs inputs) {
        this.inputs = inputs;
    }
}

