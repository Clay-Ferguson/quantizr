package quanta.rest.response.base;

import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.util.ExUtil;
import quanta.util.TL;

public class ResponseBase {
    private static Logger log = LoggerFactory.getLogger(ResponseBase.class);

    private String message;
    private String stackTrace;
    private Integer code;
    private String msgCode;

    // For diagnostic purposes we can put an info string about which replica on the docker swarm
    // was responsible for processing the request.
    private String replica;

    public String getReplica() {
        return replica;
    }

    public void setReplica(String replica) {
        this.replica = replica;
    }

    public Integer getCode() {
        return code;
    }

    public void setCode(Integer code) {
        this.code = code;
    }

    public ResponseBase() {
        TL.setResponse(this);
    }

    public void error(String msg, int code) {
        setMessage(msg);
        setCode(code);
    }

    public void error(String msg) {
        setMessage(msg);
        setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
        String stack = ExUtil.getStackTrace(null);
        setStackTrace(stack);
        log.error("error: " + msg + "\n Stack: " + stack);
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

    public String getMsgCode() {
        return msgCode;
    }

    public void setMsgCode(String msgCode) {
        this.msgCode = msgCode;
    }
}
