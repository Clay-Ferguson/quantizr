package org.subnode.types;

import java.util.LinkedList;
import java.util.List;
import javax.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class TypePluginMgr {

    @Autowired
    private FriendType friendTypePlugin;

    private List<TypeBase> types = new LinkedList<>();

    @PostConstruct
    private void init() {
        types.add(friendTypePlugin);
    }

    public List<TypeBase> getTypes() {
        return types;
    }
}
