package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum PrincipalName {

    ANON("anonymous"), //
    ADMIN("admin"), //
	PUBLIC("public");

    @JsonValue
    private final String value;

    private PrincipalName(String value) {
        this.value = value;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}