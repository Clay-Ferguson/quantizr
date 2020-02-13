package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;


/* todo-0: Oops, we have TWO classes of this same name. fix */
public enum NodeProp {
    ENC("sn:enc"),
    ENC_KEY("sn:encKey"),
    ENC_TAG("<[ENC]>");

    @JsonValue
    private final Object value;

    private NodeProp(Object value) {
        this.value = value;
    }
}