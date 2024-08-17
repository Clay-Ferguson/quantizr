package quanta.exception;

import jakarta.servlet.http.HttpServletResponse;
import quanta.exception.base.RuntimeEx;

public class ForbiddenException extends RuntimeEx {

    public ForbiddenException() {
        super("Forbidden");
    }

    public int getCode() {
        return HttpServletResponse.SC_FORBIDDEN;
    }
}
