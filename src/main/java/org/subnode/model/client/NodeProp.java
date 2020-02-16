package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;


/* todo-0: Oops, we have TWO classes of this same name. fix */
public enum NodeProp {

    //This is the encrypted symetric key to the node data, that was encrypted using the private key of the owner of the node.
    ENC_KEY("sn:encKey"),
    
    ENC_TAG("<[ENC]>");

    @JsonValue
    private final Object value;

    private NodeProp(Object value) {
        this.value = value;
    }
}