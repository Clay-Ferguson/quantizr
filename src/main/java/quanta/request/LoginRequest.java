package quanta.request;

import javax.annotation.Nullable;
import quanta.request.base.RequestBase;

public class LoginRequest extends RequestBase {
    private String userName;
    private String password;
    private String asymEncKey;
	private String sigKey;

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

    public String getAsymEncKey() {
		return asymEncKey;
	}

	public void setAsymEncKey(String asymEncKey) {
		this.asymEncKey = asymEncKey;
	}

	public String getSigKey() {
		return sigKey;
	}
    
	public void setSigKey(String sigKey) {
		this.sigKey = sigKey;
	}
}
