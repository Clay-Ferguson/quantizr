import { AppState } from "./AppState";
import { PropTable } from "./comp/PropTable";
import { PropTableCell } from "./comp/PropTableCell";
import { PropTableRow } from "./comp/PropTableRow";
import * as J from "./JavaIntf";
import { S } from "./Singletons";

export class Props {
    readOnlyPropertyList: Set<string> = new Set<string>();
    allBinaryProps: Set<string> = new Set<string>();

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
    transferBinaryProps = (srcNode: J.NodeInfo, dstNode: J.NodeInfo) => {
        if (!srcNode.properties) return;
        dstNode.properties = dstNode.properties || [];

        this.allBinaryProps.forEach(k => {
            let propVal = this.getPropStr(k, srcNode);
            if (propVal) {
                this.setPropVal(k, dstNode, propVal);
            }
            else {
                this.deleteProp(dstNode, k);
            }
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
    propsToggle = async (state: AppState) => {
        state.showProperties = !state.showProperties;
    }

    deleteProp = (node: J.NodeInfo, propertyName: string) => {
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

    getClientProp = (propName: string, node: J.NodeInfo): J.PropertyInfo => {
        if (!node || !node.clientProps) {
            return null;
        }

        return node.clientProps.find(p => p.name === propName);
    }

    /* Gets the crypto key from this node that will allow user to decrypt the node. If the user is the owner of the
    node this simply returns the ENC_KEY property but if not we look up in the ACL on the node a copy of the encrypted
    key that goes with the current user (us, logged in user), which should decrypt using our private key.
    */
    getCryptoKey = (node: J.NodeInfo, state: AppState) => {
        if (!node) return null;
        let cipherKey = null;

        /* if we own this node then this cipherKey for it will be ENC_KEY for us */
        if (state.userName === node.owner) {
            cipherKey = this.getPropStr(J.NodeProp.ENC_KEY, node);
            // console.log("getting cipherKey for node, from ENC_KEY: " + cipherKey);
        }
        /* else if the server has provided the cipher key to us from the ACL (AccessControl) then use it. */
        else {
            cipherKey = node.cipherKey;
            // console.log("getting cipherKey from node.cipherKey (not your node): " + cipherKey);
        }
        return cipherKey;
    }

    isShared = (node: J.NodeInfo): boolean => {
        return !!node.ac;
    }

    isPublic = (node: J.NodeInfo): boolean => {
        return node && node.ac && !!node.ac.find(ace => ace.principalNodeId === "public");
    }

    isPublicWritable = (node: J.NodeInfo): boolean => {
        return node && node.ac && !!node.ac.find(ace => ace.principalNodeId === "public" && this.hasPrivilege(ace, J.PrivilegeType.WRITE));
    }

    isPublicReadOnly = (node: J.NodeInfo): boolean => {
        return node && node.ac && !!node.ac.find(ace => ace.principalNodeId === "public" && !this.hasPrivilege(ace, J.PrivilegeType.WRITE));
    }

    getAcCount = (node: J.NodeInfo): number => {
        return node && node.ac ? node.ac.length : 0;
    }

    hasPrivilege = (ace: J.AccessControlInfo, priv: string): boolean => {
        if (!ace.privileges) return false;
        return !!ace.privileges.find(p => p.privilegeName.indexOf(priv) !== -1);
    }

    isMine = (node: J.NodeInfo, state: AppState): boolean => {
        if (!node || !state.userName || state.userName === J.PrincipalName.ANON) return false;
        return state.userName === node.owner;
    }

    isEncrypted = (node: J.NodeInfo): boolean => {
        return !!this.getPropStr(J.NodeProp.ENC_KEY, node);
    }

    hasBinary = (node: J.NodeInfo): boolean => {
        return !!this.getPropStr(J.NodeProp.BIN, node) ||
            !!this.getPropStr(J.NodeProp.BIN_URL, node) ||
            !!this.getPropStr(J.NodeProp.IPFS_LINK, node);
    }

    hasImage = (node: J.NodeInfo): boolean => {
        const target = this.getPropStr(J.NodeProp.BIN_MIME, node);
        return (target && target.startsWith("image/"));
    }

    hasAudio = (node: J.NodeInfo): boolean => {
        const target = this.getPropStr(J.NodeProp.BIN_MIME, node);
        return (target && target.startsWith("audio/"));
    }

    hasVideo = (node: J.NodeInfo): boolean => {
        const target = this.getPropStr(J.NodeProp.BIN_MIME, node);
        return (target && target.startsWith("video/"));
    }

    /*
     * brute force searches on node (NodeInfo.java) object properties list, and returns the first property
     * (PropertyInfo.java) with name matching propertyName, else null.
     */
    getProp = (propName: string, node: J.NodeInfo): J.PropertyInfo => {
        if (!node || !node.properties) {
            return null;
        }

        return node.properties.find(p => p.name === propName);
    }

    getPropStr = (propertyName: string, node: J.NodeInfo): string => {
        const prop: J.PropertyInfo = this.getProp(propertyName, node);
        return prop ? prop.value : null;
    }

    getPropObj = (propertyName: string, node: J.NodeInfo): any => {
        const prop: J.PropertyInfo = this.getProp(propertyName, node);
        return prop ? prop.value : null;
    }

    getClientPropStr = (propertyName: string, node: J.NodeInfo): string => {
        const prop: J.PropertyInfo = this.getClientProp(propertyName, node);
        return prop ? prop.value : null;
    }

    setPropVal = (propertyName: string, node: J.NodeInfo, val: any) => {
        let prop: J.PropertyInfo = this.getProp(propertyName, node);

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

    setProp = (node: J.NodeInfo, newProp: J.PropertyInfo) => {
        if (!newProp) return;
        const prop: J.PropertyInfo = this.getProp(newProp.name, node);

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
            J.NodeProp.BIN_URL, //

            J.NodeProp.BIN_FILENAME, //
            J.NodeProp.BIN_SIZE, //
            J.NodeProp.BIN_DATA_URL,

            J.NodeProp.IPFS_LINK, //
            J.NodeProp.IPFS_LINK_NAME, //
            J.NodeProp.IPFS_OK
        ]);

        S.util.addAllToSet(this.readOnlyPropertyList, [ //
            J.NodeProp.IMG_WIDTH, //
            J.NodeProp.IMG_HEIGHT, //
            J.NodeProp.BIN, //
            J.NodeProp.BIN_MIME, //
            J.NodeProp.BIN_SIZE, //
            J.NodeProp.BIN_FILENAME, //
            J.NodeProp.JSON_HASH, //
            J.NodeProp.IPFS_LINK, //
            J.NodeProp.ENC_KEY, //
            J.NodeProp.TYPE_LOCK, //
            J.NodeProp.UNPUBLISHED, //
            J.NodeProp.REPLY
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

    getParentPath = (node: J.NodeInfo): string => {
        let slashIdx: number = node.path.lastIndexOf("/");
        if (slashIdx === -1) return null;
        return node.path.substring(0, slashIdx);
    }
}
