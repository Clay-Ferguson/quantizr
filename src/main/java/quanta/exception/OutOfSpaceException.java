package quanta.exception;

import quanta.exception.base.RuntimeEx;

public class OutOfSpaceException extends RuntimeEx {

    public OutOfSpaceException() {
        super("Out of storage space");
    }

    public int getCode() {
        return 507;
    }
}
