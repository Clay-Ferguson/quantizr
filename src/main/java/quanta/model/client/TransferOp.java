package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum TransferOp {
    TRANSFER("transfer"), //
    ACCEPT("accept"), //
    REJECT("reject"), //
    RECLAIM("reclaim");

    @JsonValue
    private final String value;

    private TransferOp(String value) {
        this.value = value;
    }

    public static TransferOp fromString(String name) {
        if (name == null) {
            return null;
        }
        for (TransferOp e : values()) {
            if (e.value.equalsIgnoreCase(name)) {
                return e;
            }
        }
        return null;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}
