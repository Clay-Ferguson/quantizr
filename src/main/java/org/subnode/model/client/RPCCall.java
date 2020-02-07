package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

//https://github.com/vojtechhabarta/typescript-generator/issues/141
//https://github.com/vojtechhabarta/typescript-generator/issues/426

public enum RPCCall {
    login("login"),
    renderNode("renderNode");

    @JsonValue
    private final Object value;

    private RPCCall(Object value) {
        this.value = value;
    }
}