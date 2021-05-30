import { appState } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { SharingDlg } from "./dlg/SharingDlg";
import { ShareIntf } from "./intf/ShareIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Share implements ShareIntf {

    /*
     * Handles 'Sharing' button on a specific node, from button bar above node display in edit mode
     */
    editNodeSharing = async (state: AppState, node: J.NodeInfo): Promise<void> => {
        if (!node) {
            node = S.meta64.getHighlightedNode(state);
        }

        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }
        let dlg: SharingDlg = new SharingDlg(node, state);
        await dlg.open();
    }

    /* If target is non-null we only return shares to that particlar person (or public) */
    findSharedNodes = (state: AppState = null, shareTarget: string = null, accessOption: string = null): void => {
        state = appState(state);
        const focusNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (focusNode == null) {
            return;
        }

        let type = "all";
        if (accessOption === J.PrivilegeType.READ) {
            type = "read-only";
        }
        else if (accessOption === J.PrivilegeType.WRITE) {
            type = "appendable";
        }

        S.util.ajax<J.GetSharedNodesRequest, J.GetSharedNodesResponse>("getSharedNodes", {
            nodeId: focusNode.id,
            shareTarget,
            accessOption
        }, (res) => {
            S.srch.searchNodesResponse(res, "Showing " + type + " shared nodes under subgraph under node ID " + focusNode.id, false, focusNode);
        });
    }

    /* Whenever we share an encrypted node to a another user, this is the final operation we run which
    generates a key to the data which is encrypted with the public key of the person (identified by principalNodeId)
    the node is shared to. Then publishes that key info into the DB, so that only the other person who this node is shared to
    can use their private key to decrypt the key to the data, to view the node.
    */
    addCipherKeyToNode = async (node: J.NodeInfo, principalPublicKeyStr: string, principalNodeId: string): Promise<void> => {
        if (principalNodeId === "public") {
            console.warn("public node has encryption turned on. This is a bug.");
            return;
        }
        // console.log("PrincipalPublicKeyStr:" + principalPublicKeyStr + " principalNodeId:" + principalNodeId);

        // get the asym-encrypted sym Key to this node (decryptable by owner of node only, which is us)
        const cipherKey = S.props.getNodePropVal(J.NodeProp.ENC_KEY, node);
        // console.log("cipherKey on ENC_KEY: "+cipherKey);

        // get this broswer's private key from browser storage
        const privateKey: CryptoKey = await S.encryption.getPrivateKey();

        // so this is the decrypted symmetric key to the data (the unencrypted copy of the actual AES key to the data)
        const clearKey = await S.encryption.asymDecryptString(privateKey, cipherKey);
        if (!clearKey) {
            throw new Error("Unable to access encryption key.");
        }

        // console.log("clear text key to re-encrypt: " + clearKey + "\nEncrpyting key using this pub key of user: " +
        //     principalPublicKeyStr);

        // first parse the key and build a usable key from principalPublicKey.
        const principalSymKeyJsonObj: JsonWebKey = JSON.parse(principalPublicKeyStr);
        const principalPublicKey = await S.encryption.importKey(principalSymKeyJsonObj, S.encryption.ASYM_IMPORT_ALGO, true, S.encryption.OP_ENC);

        // now re-encrypt this clearTextKey using the public key (of the user being shared to).
        const userCipherKey = await S.encryption.asymEncryptString(principalPublicKey, clearKey);
        // console.log("userCipherKey=" + userCipherKey);

        /* Now post this encrypted key (decryptable only by principalNodeId's private key) up to the server which will
        then store this key alongside the ACL (access control list) for the sharing entry for this user */
        await S.util.ajax<J.SetCipherKeyRequest, J.SetCipherKeyResponse>("setCipherKey", {
            nodeId: node.id,
            principalNodeId,
            cipherKey: userCipherKey
        });
    }
}
