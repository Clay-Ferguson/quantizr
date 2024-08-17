package quanta.rest.response;

public class PushPageMessage extends ServerPushInfo {

    private String payload;
    private boolean usePopup;
    private String subType;

    public PushPageMessage(String payload, boolean usePopup, String subType) {
        super("pushPageMessage");
        this.payload = payload;
        this.usePopup = usePopup;
        this.subType = subType;
    }

    public String getPayload() {
        return this.payload;
    }

    public boolean isUsePopup() {
        return this.usePopup;
    }

    public void setPayload(final String payload) {
        this.payload = payload;
    }

    public void setUsePopup(final boolean usePopup) {
        this.usePopup = usePopup;
    }

    public PushPageMessage() {}

    public String getSubType() {
        return subType;
    }

    public void setSubType(String subType) {
        this.subType = subType;
    }
}
