package quanta.exception;

import jakarta.servlet.http.HttpServletResponse;
import quanta.exception.base.RuntimeEx;

// Exception class where we want the message to be displayed to the user
public class MessageException extends RuntimeEx {

    public MessageException(String msg) {
        super(msg);
    }

    public int getCode() {
        return HttpServletResponse.SC_SEE_OTHER;
    }
}
