package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Constant {
    SEARCH_TYPE_USER_LOCAL("userLocal"), 
    SEARCH_TYPE_USER_ALL("userAll"), 
    SEARCH_TYPE_USER_FOREIGN("userForeign"), 

    ENC_TAG("<[ENC]>");

    @JsonValue
    private final String value;

    private Constant(String value) {
        this.value = value;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}