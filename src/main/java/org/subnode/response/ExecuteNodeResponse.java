package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class ExecuteNodeResponse extends ResponseBase {
	private int returnCode;
	private String output;
	
	public int getReturnCode() {
		return returnCode;
	}
	
	public void setReturnCode(int returnCode) {
		this.returnCode = returnCode;
	}
	
	public String getOutput() {
		return output;
	}
	
	public void setOutput(String output) {
		this.output = output;
	}
}
