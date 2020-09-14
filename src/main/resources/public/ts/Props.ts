import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { PropsIntf } from "./intf/PropsIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { PropTable } from "./widget/PropTable";
import { PropTableCell } from "./widget/PropTableCell";
import { PropTableRow } from "./widget/PropTableRow";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Props implements PropsIntf {

    readOnlyPropertyList: Set<string> = new Set<string>();
    allBinaryProps: Set<string> = new Set<string>();
    // allProps: Map<string, J.NodeProp> = new Map<string, J.NodeProp>();

    /* Holds the list of properties that are edited using something like a checkbox, or dropdown menu, or whatever, such
    that it would never make sense to display an edit field for editing their value in the editor */
    controlBasedPropertyList: Set<string> = new Set<string>();

    orderProps = (propOrder: string[], _props: J.PropertyInfo[]): J.PropertyInfo[] => {
        const propsNew: J.PropertyInfo[] = S.util.arrayClone(_props);
        let targetIdx: number = 0;

        for (const prop of propOrder) {
            targetIdx = this.moveNodePosition(propsNew, targetIdx, prop);
        }

        return propsNew;
    }

    /* copies all the binary properties from source node to destination node */
    transferBinaryProps = (srcNode: J.NodeInfo, dstNode: J.NodeInfo): void => {
        if (!srcNode.properties) return;
        dstNode.properties = dstNode.properties || [];
        this.allBinaryProps.forEach(k => {
            this.setNodeProp(dstNode, S.props.getNodeProp(k, srcNode));
        });
    }

    moveNodePosition = (props: J.PropertyInfo[], idx: number, typeName: string): number => {
        const tagIdx: number = S.util.arrayIndexOfItemByProp(props, "name", typeName);
        if (tagIdx !== -1) {
            S.util.arrayMoveItem(props, tagIdx, idx++);
        }
        return idx;
    }

    /*
     * Toggles display of properties in the gui.
     */
    propsToggle = async (state: AppState): Promise<void> => {
        state.showProperties = !state.showProperties;
    }

    deleteProp = (node: J.NodeInfo, propertyName: string): void => {
        if (node.properties) {
            for (let i = 0; i < node.properties.length; i++) {
                if (propertyName === node.properties[i].name) {
                    // splice is how to delete array elements in js.
                    node.properties.splice(i, 1);
                    break;
                }
            }
        }
    }

    /* Moves all the properties listed in propList array to the end of the list of properties and keeps them in the order specified */
    private movePropsToTop = (propsList: string[], props: J.PropertyInfo[]) => {
        for (const prop of propsList) {
            const tagIdx = S.util.arrayIndexOfItemByProp(props, "name", prop);
            if (tagIdx !== -1) {
                S.util.arrayMoveItem(props, tagIdx, 0);
            }
        }
    }

    /* Moves all the properties listed in propList array to the end of the list of properties and keeps them in the order specified */
    private movePropsToEnd = (propsList: string[], props: J.PropertyInfo[]) => {
        for (const prop of propsList) {
            const tagIdx = S.util.arrayIndexOfItemByProp(props, "name", prop);
            if (tagIdx !== -1) {
                S.util.arrayMoveItem(props, tagIdx, props.length);
            }
        }
    }

    /*
     * properties will be null or a list of PropertyInfo objects.
     */
    renderProperties = (properties: J.PropertyInfo[]): PropTable => {
        if (properties) {
            const propTable = new PropTable({
                border: "1",
                className: "property-table"
                // "sourceClass" : "[propsTable]"
            });

            properties.forEach(function (property: J.PropertyInfo) {
                // console.log("Render Prop: "+property.name);
                const propNameCell = new PropTableCell(property.name, {
                    className: "prop-table-name-col"
                });

                const valCellAttrs = {
                    className: "prop-table-val-col"
                };
                const propValCell: PropTableCell = new PropTableCell(property.value, valCellAttrs);

                const propTableRow = new PropTableRow({
                    className: "prop-table-row"
                }, [propNameCell, propValCell]);
                propTable.addChild(propTableRow);
            });
            return propTable;
        } else {
            return null;
        }
    }

    /*
     * brute force searches on node (NodeInfo.java) object properties list, and returns the first property
     * (PropertyInfo.java) with name matching propertyName, else null.
     */
    getNodeProp = (propName: string, node: J.NodeInfo): J.PropertyInfo => {
        if (!node || !node.properties) {
            return null;
        }

        return node.properties.find(p => p.name === propName);
    }

    /* Gets the crypto key from this node that will allow user to decrypt the node. If the user is the owner of the
node this simply returns the ENC_KEY property but if not we look up in the ACL on the node a copy of the encrypted
    key that goes with the current user (us, logged in user), which should decrypt using our private key.
    */
    getCryptoKey = (node: J.NodeInfo, state: AppState) => {
        let cipherKey = null;

        /* if we own this node then this cipherKey for it will be ENC_KEY for us */
        if (state.userName === node.owner) {
            cipherKey = S.props.getNodePropVal(J.NodeProp.ENC_KEY, node);
            console.log("getting cipherKey for node, from ENC_KEY: " + cipherKey);
        }
        /* else if the server has provided the cipher key to us from the ACL (AccessControl) then use it. */
        else {
            cipherKey = node.cipherKey;
            console.log("getting cipherKey from node.cipherKey (not your node): " + cipherKey);
        }
        return cipherKey;
    }

    isShared = (node: J.NodeInfo): boolean => {
        return !!node.ac;
    }

    isPublic = (node: J.NodeInfo): boolean => {
        return node && node.ac && !!node.ac.find(ace => ace.principalNodeId === "public");
    }

    isMine = (node: J.NodeInfo, state: AppState): boolean => {
        if (!state.userName || state.userName === J.PrincipalName.ANON) return false;
        return state.userName === node.owner;
    }

    isEncrypted = (node: J.NodeInfo): boolean => {
        return !!S.props.getNodePropVal(J.NodeProp.ENC_KEY, node);
    }

    hasBinary = (node: J.NodeInfo): boolean => {
        return !!S.props.getNodePropVal(J.NodeProp.BIN, node) ||
            !!S.props.getNodePropVal(J.NodeProp.IPFS_LINK, node);
    }

    hasImage = (node: J.NodeInfo): boolean => {
        const target = S.props.getNodePropVal(J.NodeProp.BIN_MIME, node);
        return (target && target.startsWith("image/"));
    }

    hasAudio = (node: J.NodeInfo): boolean => {
        const target = S.props.getNodePropVal(J.NodeProp.BIN_MIME, node);
        return (target && target.startsWith("audio/"));
    }

    hasVideo = (node: J.NodeInfo): boolean => {
        const target = S.props.getNodePropVal(J.NodeProp.BIN_MIME, node);
        return (target && target.startsWith("video/"));
    }

    getNodePropVal = (propertyName: string, node: J.NodeInfo): string => {
        const prop: J.PropertyInfo = this.getNodeProp(propertyName, node);
        return prop ? prop.value : null;
    }

    setNodePropVal = (propertyName: string, node: J.NodeInfo, val: string): void => {
        let prop: J.PropertyInfo = this.getNodeProp(propertyName, node);

        /* If we found a property by propertyName, then set it's value */
        if (prop) {
            prop.value = val;
        }
        /* Else this is a new property we must add (ret remains true here) */
        else {
            prop = {
                name: propertyName,
                value: val
            };
            if (!node.properties) {
                node.properties = [];
            }
            node.properties.push(prop);
        }
    }

    setNodeProp = (node: J.NodeInfo, newProp: J.PropertyInfo): void => {
        if (!newProp) return;
        const prop: J.PropertyInfo = this.getNodeProp(newProp.name, node);

        /* If we found a property by propertyName, then set it's value */
        if (prop) {
            prop.value = newProp.value;
        }
        /* Else this is a new property we must add (ret remains true here) */
        else {
            if (!node.properties) {
                node.properties = [];
            }
            node.properties.push(newProp);
        }
    }

    // here's the simple mode property hider!
    initConstants = () => {
        S.util.addAllToSet(this.allBinaryProps, [ //
            J.NodeProp.IMG_WIDTH, //
            J.NodeProp.IMG_HEIGHT, //
            J.NodeProp.IMG_SIZE, //
            J.NodeProp.BIN_MIME, //
            J.NodeProp.BIN, //

            J.NodeProp.BIN_FILENAME, //
            J.NodeProp.BIN_SIZE, //
            J.NodeProp.BIN_DATA_URL,

            J.NodeProp.IPFS_LINK, //
            J.NodeProp.IPFS_LINK_NAME, //
            J.NodeProp.IPFS_OK //
        ]);

        S.util.addAllToSet(this.readOnlyPropertyList, [ //
            J.NodeProp.IMG_WIDTH, //
            J.NodeProp.IMG_HEIGHT, //
            J.NodeProp.BIN, //
            J.NodeProp.BIN_MIME, //
            J.NodeProp.BIN_SIZE, //
            J.NodeProp.BIN_FILENAME, //
            J.NodeProp.JSON_HASH, //
            J.NodeProp.IPFS_LINK
        ]);

        S.util.addAllToSet(this.controlBasedPropertyList, [ //
            J.NodeProp.INLINE_CHILDREN, //
            J.NodeProp.NOWRAP, //
            J.NodeProp.SAVE_TO_IPFS, //
            J.NodeProp.LAYOUT, //
            J.NodeProp.PRIORITY, //
            J.NodeProp.IMG_SIZE,
            J.NodeProp.CHILDREN_IMG_SIZES
        ]);
    }

    /* This is kind of a hard-coded hack for the one particular type name
    where we are using it, but needs to work for all properties */
    getInputClassForType = (typeName: string): string => {
        if (typeName === "duration") {
            return "durationTypeInput";
        }
        return null;
    }

    // /*
    //  * Returns trus if this is a node the current user doesn't own. Used to disable "edit", "delete",
    //  * etc. on the GUI.
    //  */
    // isNonOwnedNode = (node: J.NodeInfo): boolean => {
    //     let owner: string = node.owner;

    //     // if we don't know who owns this node assume the admin owns it.
    //     if (!owner) {
    //         owner = "admin";
    //     }

    //     return owner != meta64.userName;
    // }
}
