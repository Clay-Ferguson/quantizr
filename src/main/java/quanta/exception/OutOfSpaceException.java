package quanta.exception;

import quanta.exception.base.RuntimeEx;

public class OutOfSpaceException extends RuntimeEx {

    public int getCode() {
        return 507;
    }
}
