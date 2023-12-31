package quanta.model.client.openai;

public class SpeechGenRequest {
    public String model;
    public String input;
    public String voice;

    public SpeechGenRequest() {}

    public SpeechGenRequest(String model, String input, String voice) {
        this.model = model;
        this.input = input;
        this.voice = voice;
    }

    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }

    public String getVoice() {
        return voice;
    }

    public void setVoice(String voice) {
        this.voice = voice;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }
}
