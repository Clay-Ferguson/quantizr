package org.subnode.types;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.model.NodeInfo;
import org.subnode.model.PropertyInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;

@Component
public class FriendType extends TypeBase {

    @Autowired
    private MongoRead read;

    @Override
    public String getName() {
        return "sn:friend";
    }

    @Override
    public void convert(MongoSession session, NodeInfo nodeInfo, SubNode node, boolean getFollowers) {
        // yes this is redundant and loads userUrl again below, but I need to test this before removing it.
        String userUrl = node.getStrProp(NodeProp.ACT_PUB_ACTOR_URL.s());
        if (userUrl != null) {
            nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.ACT_PUB_ACTOR_URL.s(), userUrl));
        }

        /*
         * Get info from accountId based on the node.owner if this is presenting Followers list, or else
         * from USER_NODE_ID, if we're just displaying a Friend node 'as is' (i.e. based on who it points to
         * as the friend)
         */
        String accountId = getFollowers ? node.getOwner().toHexString() : node.getStrProp(NodeProp.USER_NODE_ID);
        // log.debug("friendAccountId=" + friendAccountId + " on nodeId=" + node.getId().toHexString());

        /*
         * NOTE: Right when the Friend node is first created, before a person has been selected, this WILL
         * be null, and is normal
         */
        if (accountId != null) {
            SubNode accountNode = read.getNode(session, accountId, false);

            /*
             * to load up a friend node for the browser to display, we have to populate these "Client Props", on
             * the node object which are not properties of the node itself but values we generate right here on
             * demand. The "Client Props" is a completely different set than the actual node properties
             */
            if (accountNode != null) {
                /* NOTE: This will be the bio for both ActivityPub users and local users */
                String userBio = accountNode.getStrProp(NodeProp.USER_BIO.s());
                if (userBio != null) {
                    nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.USER_BIO.s(), userBio));
                }

                userUrl = accountNode.getStrProp(NodeProp.ACT_PUB_ACTOR_URL.s());
                if (userUrl != null) {
                    nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.ACT_PUB_ACTOR_URL.s(), userUrl));
                }

                nodeInfo.safeGetClientProps().add(new PropertyInfo("accntId", accountId));
                nodeInfo.safeGetClientProps().add(new PropertyInfo("accntUser", accountNode.getStrProp(NodeProp.USER.s())));

                String friendAvatarVer = accountNode.getStrProp(NodeProp.BIN.s());
                if (friendAvatarVer != null) {
                    nodeInfo.safeGetClientProps().add(new PropertyInfo("avatarVer", friendAvatarVer));
                }

                String friendDisplayName = accountNode.getStrProp(NodeProp.DISPLAY_NAME.s());
                if (friendDisplayName != null) {
                    nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.DISPLAY_NAME.s(), friendDisplayName));
                }

                /*
                 * Note: for ActivityPub foreign users we have this property on their account node that points to
                 * the live URL of their account avatar as it was found in their Actor object
                 */

                String userIconUrl = accountNode.getStrProp(NodeProp.ACT_PUB_USER_ICON_URL.s());
                if (userIconUrl != null) {
                    nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.ACT_PUB_USER_ICON_URL.s(), userIconUrl));
                }

                // todo-1: for now the client isn't rendering the header image so there's no ACT_PUB_USER_IMAGE_URL
                // right here which is how we can do that at some point in the future maybe.
            }
        }
    }
}
