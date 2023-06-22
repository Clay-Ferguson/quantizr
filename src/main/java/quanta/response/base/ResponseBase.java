package quanta.response.base;

import javax.servlet.http.HttpServletResponse;
import quanta.util.ThreadLocals;

public class ResponseBase {

    private String message;
    private String stackTrace;
    private Integer code;

    public Integer getCode() {
        return code;
    }

    public void setCode(Integer code) {
        this.code = code;
    }

    public ResponseBase() {
        ThreadLocals.setResponse(this);
    }

    public void error(String msg, int code) {
        setMessage(msg);
        setCode(code);
    }

    public void error(String msg) {
        setMessage(msg);
        setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getStackTrace() {
        return this.stackTrace;
    }

    public void setStackTrace(String stackTrace) {
        this.stackTrace = stackTrace;
    }
}
