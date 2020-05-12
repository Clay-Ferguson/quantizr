import * as J from "./JavaIntf";
import { SharingDlg } from "./dlg/SharingDlg";
import { ShareIntf } from "./intf/ShareIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { SymKeyDataPackage } from "./intf/EncryptionIntf";
import { AppState } from "./AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Share implements ShareIntf {

    /*
     * Handles 'Sharing' button on a specific node, from button bar above node display in edit mode
     */
    editNodeSharing = (state: AppState): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode(state);

        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }
        new SharingDlg(node, state).open();
    }

    /* If target is non-null we only return shares to that particlar person (or public) */
    findSharedNodes = (state: AppState, shareTarget: string): void => {
        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (focusNode == null) {
            return;
        }

        S.util.ajax<J.GetSharedNodesRequest, J.GetSharedNodesResponse>("getSharedNodes", {
            nodeId: focusNode.id,
            shareTarget
        }, (res) => {
            S.srch.searchNodesResponse(res);
        });
    }

    /* Whenever an encrypted node is shared to a user, this is the final operation we run which
    generates a key to the data, encrypted with the public key of the person (identified by principalNodeId) 
    the node is shared to, and then publishes that info into the DB 
    */
    addCipherKeyToNode = async (node: J.NodeInfo, principalPublicKeyStr: string, principalNodeId: string): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            if (principalNodeId=="public") {
                console.warn("public node has encryption turned on. This is a bug.");
                resolve();
            }
            //console.log("PrincipalPublicKeyStr:" + principalPublicKeyStr + " principalNodeId:" + principalNodeId);

            //get the asym-encrypted sym Key to this node (decryptable by owner of node only, which is us)
            let cipherKey = S.props.getNodePropVal(J.NodeProp.ENC_KEY, node);
            //console.log("cipherKey on ENC_KEY: "+cipherKey);

            let privateKey: CryptoKey = await S.encryption.getPrivateKey();

            //so this is the decrypted symmetric key to the data
            let clearTextKey = await S.encryption.asymDecryptString(privateKey, cipherKey);
            if (!clearTextKey) {
                throw new Error("Unable to access encryption key.");
            }

            //console.log("clear text key to re-encrypt: " + clearTextKey);

            //first build up a usable key from principalPublicKey.
            let principalSymKeyJsonObj: JsonWebKey = JSON.parse(principalPublicKeyStr);

            let principalPublicKey = await S.encryption.importKey(principalSymKeyJsonObj, S.encryption.ASYM_IMPORT_ALGO, true, S.encryption.OP_ENC);

            //now re-encrypt this clearTextKey using the public key (of the user being shared to).
            let userCipherKey = await S.encryption.asymEncryptString(principalPublicKey, clearTextKey);
            //console.log("userCipherKey=" + userCipherKey);

            await S.util.ajax<J.SetCipherKeyRequest, J.SetCipherKeyResponse>("setCipherKey", {
                nodeId: node.id,
                principalNodeId: principalNodeId,
                cipherKey: userCipherKey,
            });

            //console.log("Added cipher key: " + userCipherKey + " for principalNodeId: " + principalNodeId);

            resolve();
        });
    }
}
