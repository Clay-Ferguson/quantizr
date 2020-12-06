package org.subnode.actpub;

import java.util.LinkedList;

public class APList extends LinkedList<Object> {
    private static final long serialVersionUID = 1L;

    public APList() {
    }

    public APList val(Object val) {
        super.add(val);
        return this;
    }
}
