package quanta.model.client.openai;

public class SystemConfig {
    private String prompt; // ex: "you are a helpful assistant"
    private String model; // ex: "gpt-4"

    // todo-1: add a way for users to alter this.
    private Double temperature = 0.7;

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public boolean isConfigured() {
        return prompt != null && model != null;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }
}
