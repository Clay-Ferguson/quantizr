package org.subnode.exception;

import org.subnode.exception.base.RuntimeEx;

public class HashVerifyFailedException extends RuntimeEx {

	public HashVerifyFailedException(String msg) {
		super(msg);
	}
}
