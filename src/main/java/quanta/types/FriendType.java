package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.NodeInfo;
import quanta.model.PropertyInfo;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;

// IMPORTANT: See TypePluginMgr, and ServiceBase instantiation to initialize tyese Plugin types
@Component 
public class FriendType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.FRIEND.s();
    }

    @Override
    public void convert(NodeInfo nodeInfo, SubNode node, SubNode ownerAccntNode,
            boolean getFollowers) {
        /*
         * Get info from accountId based on the node.owner if this is presenting Followers list, or else
         * from USER_NODE_ID, if we're just displaying a Friend node 'as is' (i.e. based on who it points to
         * as the friend)
         */
        String accountId = getFollowers ? node.getOwner().toHexString() : node.getStr(NodeProp.USER_NODE_ID);

        /*
         * NOTE: Right when the Friend node is first created, before a person has been selected, this WILL
         * be null, and is normal
         */
        if (accountId != null) {
            AccountNode accountNode = svc_user.getAccountNodeAP(accountId);

            /*
             * to load up a friend node for the browser to display, we have to populate these "Client Props", on
             * the node object which are not properties of the node itself but values we generate right here on
             * demand. The "Client Props" is a completely different set than the actual node properties
             */
            if (accountNode != null) {
                String userBio = accountNode.getStr(NodeProp.USER_BIO);
                if (userBio != null) {
                    nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.USER_BIO.s(), userBio));
                }

                nodeInfo.safeGetClientProps().add(new PropertyInfo("accntId", accountId));
                nodeInfo.safeGetClientProps().add(new PropertyInfo("accntUser", accountNode.getStr(NodeProp.USER)));

                Attachment att = accountNode.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
                if (att != null && att.getBin() != null) {
                    nodeInfo.safeGetClientProps().add(new PropertyInfo("avatarVer", att.getBin()));
                }

                String friendDisplayName = svc_user.getFriendlyNameFromNode(accountNode);
                if (friendDisplayName != null) {
                    nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.DISPLAY_NAME.s(), friendDisplayName));
                }
            }
        }
    }
}
