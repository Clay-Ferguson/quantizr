package quanta.model.client.openai;

public class Choice {
    private ChatMessage message;
    private double finishProbability;
    private int index;

    public Choice() {}

    public ChatMessage getMessage() {
        return message;
    }

    public void setMessage(ChatMessage message) {
        this.message = message;
    }

    public double getFinishProbability() {
        return finishProbability;
    }

    public void setFinishProbability(double finishProbability) {
        this.finishProbability = finishProbability;
    }

    public int getIndex() {
        return index;
    }

    public void setIndex(int index) {
        this.index = index;
    }
}
