package quanta.exception;

import javax.servlet.http.HttpServletResponse;
import quanta.exception.base.RuntimeEx;

public class HashVerifyFailedException extends RuntimeEx {

    public int getCode() {
        // use better code than this (todo-0)
        return HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
    }

    public HashVerifyFailedException(String msg) {
        super(msg);
    }
}
