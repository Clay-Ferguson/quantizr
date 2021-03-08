package org.subnode.request.base;

import javax.annotation.Nullable;

/* right now this is just a marker class, for cleaner code */
public class RequestBase {
    //todo-2: the @Nullable capability is new and could be used across lots of existing objects.
    @Nullable
    private String userName;

    @Nullable
    private String password;

    /* timezone offset */
    @Nullable
	private Integer tzOffset;

    /* daylight savings time */
    @Nullable
	private Boolean dst;

    public Integer getTzOffset() {
        return tzOffset;
    }

    public void setTzOffset(Integer tzOffset) {
        this.tzOffset = tzOffset;
    }

    public Boolean getDst() {
        return dst;
    }

    public void setDst(Boolean dst) {
        this.dst = dst;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
