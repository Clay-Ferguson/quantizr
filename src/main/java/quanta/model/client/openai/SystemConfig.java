package quanta.model.client.openai;

public class SystemConfig {
    private String prompt; // ex: "you are a helpful assistant"
    private String template;
    private String model; // ex: "gpt-4"
    private String service;

    // todo-2: add a way for users to alter this.
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

    public String getService() {
        return service;
    }

    public void setService(String service) {
        this.service = service;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public String getTemplate() {
        return template;
    }

    public void setTemplate(String template) {
        this.template = template;
    }
}
