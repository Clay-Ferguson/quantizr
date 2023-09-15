package quanta.exception;

import javax.servlet.http.HttpServletResponse;
import quanta.exception.base.RuntimeEx;

public class UnauthorizedException extends RuntimeEx {

    public UnauthorizedException() {
        super("Unauthorized");
    }

    public int getCode() {
        return HttpServletResponse.SC_UNAUTHORIZED;
    }
}
