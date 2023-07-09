package quanta.config;

import java.io.Serializable;

public class RedisMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    private String message;

    public RedisMessage() {}

    public RedisMessage(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
