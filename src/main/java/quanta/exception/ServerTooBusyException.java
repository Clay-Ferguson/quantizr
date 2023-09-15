package quanta.exception;

import javax.servlet.http.HttpServletResponse;
import quanta.exception.base.RuntimeEx;

public class ServerTooBusyException extends RuntimeEx {

    public ServerTooBusyException() {
        super("Server too busy(1)");
    }

    public int getCode() {
        return HttpServletResponse.SC_SERVICE_UNAVAILABLE;
    }
}
