import * as J from "./JavaIntf";
import { SharingDlg } from "./dlg/SharingDlg";
import { ShareIntf } from "./intf/ShareIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { SymKeyDataPackage } from "./intf/EncryptionIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Share implements ShareIntf {

    private findSharedNodesResponse = (res: J.GetSharedNodesResponse) => {
        S.srch.searchNodesResponse(res);
    }

    /*
     * Handles 'Sharing' button on a specific node, from button bar above node display in edit mode
     */
    editNodeSharing = (): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode();

        if (!node) {
            S.util.showMessage("No node is selected.");
            return;
        }
        new SharingDlg(node).open();
    }

    findSharedNodes = (): void => {
        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode();
        if (focusNode == null) {
            return;
        }

        S.util.ajax<J.GetSharedNodesRequest, J.GetSharedNodesResponse>("getSharedNodes", {
            "nodeId": focusNode.id
        }, this.findSharedNodesResponse);
    }

    /* Whenever an encrypted node is shared to a user, this is the final operation we run which
    generates a key to the data, encrypted with the public key of the person (identified by principleNodeId) 
    the node is shared to, and then publishes that info into the DB 

    todo-0: principle is misspelled. clean up all misspellings of principle and cypher.
    */
    addCipherKeyToNode = async (node: J.NodeInfo, principlePublicKeyStr: string, principleNodeId: string): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            if (principleNodeId=="public") {
                console.warn("public node has encryption turned on. This is a bug.");
                resolve();
            }
            //console.log("PrinciplePublicKeyStr:" + principlePublicKeyStr + " principleNodeId:" + principleNodeId);

            //get the asym-encrypted sym Key to this node (decryptable by owner of node only, which is us)
            let cypherKey = S.props.getNodePropVal(J.NodeProp.ENC_KEY, node);
            //console.log("cypherKey on ENC_KEY: "+cypherKey);

            let privateKey: CryptoKey = await S.encryption.getPrivateKey();

            //so this is the decrypted symmetric key to the data
            let clearTextKey = await S.encryption.asymDecryptString(privateKey, cypherKey);
            if (!clearTextKey) {
                throw new Error("Unable to access encryption key.");
            }

            //console.log("clear text key to re-encrypt: " + clearTextKey);

            //first build up a usable key from principlePublicKey.
            let principalSymKeyJsonObj: JsonWebKey = JSON.parse(principlePublicKeyStr);

            //todo-0: this is ugly and should be encapsulated into S.encryption
            let principalPublicKey = await crypto.subtle.importKey(S.encryption.KEY_SAVE_FORMAT, principalSymKeyJsonObj, {
                name: S.encryption.ASYM_ALGO,
                hash: S.encryption.HASH_ALGO,
            }, true, S.encryption.OP_ENC);

            //now re-encrypt this clearTextKey using the public key (of the user being shared to).
            let userCipherKey = await S.encryption.asymEncryptString(principalPublicKey, clearTextKey);
            //console.log("userCipherKey=" + userCipherKey);

            await S.util.ajax<J.SetCipherKeyRequest, J.SetCipherKeyResponse>("setCipherKey", {
                "nodeId": node.id,
                "principalNodeId": principleNodeId,
                "cipherKey": userCipherKey,
            });

            //console.log("Added cypher key: " + userCipherKey + " for principleNodeId: " + principleNodeId);

            resolve();
        });
    }
}
