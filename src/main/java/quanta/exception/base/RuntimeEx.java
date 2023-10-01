package quanta.exception.base;

import jakarta.servlet.http.HttpServletResponse;

public class RuntimeEx extends RuntimeException {

    public int getCode() {
        return HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
    }

    public RuntimeEx() {
        super();
    }

    public RuntimeEx(String msg) {
        super(msg);
    }

    public RuntimeEx(String msg, Throwable ex) {
        super(msg, ex);
    }

    public RuntimeEx(Throwable ex) {
        super(ex);
    }
}
