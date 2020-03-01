package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

/* NOTE: This class is exported into typescript (using typescript-generator-maven-plugin), and this is currently still
the only way to achieve "constants" in Java converted to Typescript. It would be nice of we could just hava a class with
a bunch of "" values in it but there's no way to do that and then have it export to TypeScript also.

todo-0: put this not in a single readme.md file
 */
public enum Constant {

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