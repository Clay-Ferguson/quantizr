package quanta.exception;

import jakarta.servlet.http.HttpServletResponse;
import quanta.exception.base.RuntimeEx;

public class ServerTooBusyException extends RuntimeEx {

    public ServerTooBusyException(String url) {
        super("Server too busy: Failed on " + url);
    }

    public int getCode() {
        return HttpServletResponse.SC_SERVICE_UNAVAILABLE;
    }
}
