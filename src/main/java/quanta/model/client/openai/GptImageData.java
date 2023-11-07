package quanta.model.client.openai;

public class GptImageData {
    public String revised_prompt;
    public String url;

    public GptImageData() {}

    public String getRevised_prompt() {
        return revised_prompt;
    }

    public void setRevised_prompt(String revised_prompt) {
        this.revised_prompt = revised_prompt;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
