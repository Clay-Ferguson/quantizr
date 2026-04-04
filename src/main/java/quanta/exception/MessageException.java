package quanta.exception;

import jakarta.servlet.http.HttpServletResponse;
import quanta.exception.base.RuntimeEx;

// Exception class where we want the message to be displayed to the user
public class MessageException extends RuntimeEx {
    private String msgCode;

    public MessageException(String msg) {
        super(msg);
    }

    public MessageException(String msg, String msgCode) {
        super(msg);
        this.msgCode = msgCode;
    }

    public int getCode() {
        return HttpServletResponse.SC_SEE_OTHER;
    }

    public String getMsgCode() {
        return msgCode;
    }

    public void setMsgCode(String msgCode) {
        this.msgCode = msgCode;
    }
}
