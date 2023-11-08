package quanta.model.client.openai;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ImageGenRequest {
    public String model;
    public String prompt;
    public Integer numImages;
    public String size; // 1024x1024, 1024x1792 or 1792x1024
    public String quality; // 'hd' or null

    public ImageGenRequest() {}

    public ImageGenRequest(String model, String prompt, Integer numImages, String size, String quality) {
        this.model = model;
        this.prompt = prompt;
        this.numImages = numImages;
        this.size = size;
        this.quality = quality;
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

    public String getQuality() {
        return quality;
    }

    public void setQuality(String quality) {
        this.quality = quality;
    }
}
