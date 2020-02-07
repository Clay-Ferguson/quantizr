package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeProp {
    ENC("sn:enc"),
    ENC_TAG("<[ENC]>");

    @JsonValue
    private final Object value;

    private NodeProp(Object value) {
        this.value = value;
    }
}