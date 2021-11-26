package org.subnode.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.ServiceBase;

/**
 * Part of SpringSecurity implementation
 */
@Service
public class AppUserDetailsService extends ServiceBase implements UserDetailsService {
    private static final Logger log = LoggerFactory.getLogger(AppUserDetailsService.class);

    @Override
    public UserDetails loadUserByUsername(String userName) throws UsernameNotFoundException {
        if (PrincipalName.ADMIN.s().equals(userName)) {
            return new AppUserDetails(userName, prop.getMongoAdminPassword());
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
