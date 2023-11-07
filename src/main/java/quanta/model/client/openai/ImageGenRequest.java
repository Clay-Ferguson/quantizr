package quanta.model.client.openai;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ImageGenRequest {
    public String model;
    public String prompt;
    public Integer numImages;
    public String size;

    public ImageGenRequest() {}

    public ImageGenRequest(String model, String prompt, Integer numImages, String size) {
        this.model = model;
        this.prompt = prompt;
        this.numImages = numImages;
        this.size = size;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    @JsonProperty("n")
    public Integer getNumImages() {
        return numImages;
    }

    @JsonProperty("n")
    public void setNumImages(Integer numImages) {
        this.numImages = numImages;
    }

    public String getSize() {
        return size;
    }

    public void setSize(String size) {
        this.size = size;
    }
}
