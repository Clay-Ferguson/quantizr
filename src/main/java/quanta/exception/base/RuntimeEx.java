package quanta.exception.base;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.servlet.http.HttpServletResponse;
import quanta.util.ExUtil;

public class RuntimeEx extends RuntimeException {
    private static Logger log = LoggerFactory.getLogger(RuntimeEx.class);
    public boolean logged = false;

    public RuntimeEx() {
        super();
        ExUtil.error(log, this);
    }

    public RuntimeEx(String msg) {
        super(msg);
        ExUtil.error(log, this);
    }

    public RuntimeEx(String msg, Throwable ex) {
        super(msg + " -> CORE MSG: " + ex.getMessage(), ex);
        ExUtil.error(log, this);
    }

    public RuntimeEx(Throwable ex) {
        super(ex);
        ExUtil.error(log, this);
    }

    public int getCode() {
        return HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
    }
}
