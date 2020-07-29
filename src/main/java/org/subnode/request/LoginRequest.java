package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class LoginRequest extends RequestBase {

	//RequestBase contains everything we need for a login, and this is done so that any timeout that happens on the server
	//gets auto-repaired by logging in again automatically as needed.	
}
