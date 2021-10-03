package org.subnode.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.model.SubNode;

@Service
public class AppUserDetailsService implements UserDetailsService {
    private static final Logger log = LoggerFactory.getLogger(AppUserDetailsService.class);

    @Autowired
    private MongoAuth auth;

    @Autowired
    private MongoRead read;

    @Autowired
    private AppProp appProp;

    @Override
    public UserDetails loadUserByUsername(String userName) throws UsernameNotFoundException {
        if (PrincipalName.ADMIN.s().equals(userName)) {
            return new AppUserDetails(userName, appProp.getMongoAdminPassword());
        } else {
            SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), userName);
            if (userNode != null) {
                String pwdHash = userNode.getStrProp(NodeProp.PWD_HASH.s());
                return new AppUserDetails(userName, pwdHash);
            } else {
                throw new UsernameNotFoundException("Not found: " + userName);
            }
        }
    }
}
