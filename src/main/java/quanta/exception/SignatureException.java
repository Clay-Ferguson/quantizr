package quanta.exception;

import jakarta.servlet.http.HttpServletResponse;
import quanta.exception.base.RuntimeEx;

public class SignatureException extends RuntimeEx {

    public SignatureException() {
        super("Signature Exception");
    }

    public SignatureException(String msg) {
        super(msg);
    }

    public int getCode() {
        return HttpServletResponse.SC_EXPECTATION_FAILED;
    }
}
