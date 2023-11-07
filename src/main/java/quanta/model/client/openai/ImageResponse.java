package quanta.model.client.openai;

import java.util.List;

public class ImageResponse {
    public Integer created;
    public List<GptImageData> data;

    public ImageResponse() {}

    public Integer getCreated() {
        return created;
    }

    public void setCreated(Integer created) {
        this.created = created;
    }

    public List<GptImageData> getData() {
        return data;
    }

    public void setData(List<GptImageData> data) {
        this.data = data;
    }
}
