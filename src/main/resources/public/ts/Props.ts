import * as I from "./Interfaces";
import { PropTable } from "./widget/PropTable";
import { PropTableRow } from "./widget/PropTableRow";
import { PropTableCell } from "./widget/PropTableCell";

import { Constants as cnst } from "./Constants";
import { PropsIntf } from "./intf/PropsIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Props implements PropsIntf {

    orderProps = (propOrder: string[], _props: I.PropertyInfo[]): I.PropertyInfo[] => {
        let propsNew: I.PropertyInfo[] = S.util.arrayClone(_props);
        let targetIdx: number = 0;

        for (let prop of propOrder) {
            targetIdx = this.moveNodePosition(propsNew, targetIdx, prop);
        }

        return propsNew;
    }

    moveNodePosition = (props: I.PropertyInfo[], idx: number, typeName: string): number => {
        let tagIdx: number = S.util.arrayIndexOfItemByProp(props, "name", typeName);
        if (tagIdx != -1) {
            S.util.arrayMoveItem(props, tagIdx, idx++);
        }
        return idx;
    }

    /*
     * Toggles display of properties in the gui.
     */
    propsToggle = async (): Promise<void> => {
        S.meta64.showProperties = S.meta64.showProperties ? false : true;
        await S.render.renderPageFromData();
    }

    deletePropertyFromLocalData = (node: I.NodeInfo, propertyName: string): void => {
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

    /*
     * Sorts props input array into the proper order to show for editing. Simple algorithm first grabs 'jcr:content'
     * node and puts it on the top, and then does same for 'jctCnst.TAGS'
     */
    getPropertiesInEditingOrder = (node: I.NodeInfo, _props: I.PropertyInfo[]): I.PropertyInfo[] => {
        let typeHandler: TypeHandlerIntf = S.meta64.typeHandlers[node.type];
        if (typeHandler) {
            return typeHandler.orderProps(node, _props);
        }
        else {
            //let propsNew: I.PropertyInfo[] = S.util.arrayClone(_props);
            //this.movePropsToTop([cnst.CONTENT, cnst.TAGS], propsNew);
            //this.movePropsToEnd([jcrCnst.CREATED, jcrCnst.OWNER, jcrCnst.LAST_MODIFIED], propsNew);
            //return propsNew;
            return _props;
        }
    }

    /* Moves all the properties listed in propList array to the end of the list of properties and keeps them in the order specified */
    private movePropsToTop = (propsList: string[], props: I.PropertyInfo[]) => {
        for (let prop of propsList) {
            let tagIdx = S.util.arrayIndexOfItemByProp(props, "name", prop);
            if (tagIdx != -1) {
                S.util.arrayMoveItem(props, tagIdx, 0);
            }
        }
    }

    /* Moves all the properties listed in propList array to the end of the list of properties and keeps them in the order specified */
    private movePropsToEnd = (propsList: string[], props: I.PropertyInfo[]) => {
        for (let prop of propsList) {
            let tagIdx = S.util.arrayIndexOfItemByProp(props, "name", prop);
            if (tagIdx != -1) {
                S.util.arrayMoveItem(props, tagIdx, props.length);
            }
        }
    }

    /*
     * properties will be null or a list of PropertyInfo objects.
     */
    renderProperties = (properties: I.PropertyInfo[]): PropTable => {
        if (properties) {
            let propTable = new PropTable({
                "border": "1",
                className: "property-table"
                // "sourceClass" : "[propsTable]"
            });

            properties.forEach((property: I.PropertyInfo) => {
                //console.log("Render Prop: "+property.name);
                if (S.render.allowPropertyToDisplay(property.name)) {
                    var isBinaryProp = S.render.isBinaryProperty(property.name);

                    let propNameCell = new PropTableCell(S.render.sanitizePropertyName(property.name), {
                        className: "prop-table-name-col"
                    });

                    let valCellAttrs = {
                        className: "prop-table-val-col"
                    };
                    let propValCell: PropTableCell;

                    if (isBinaryProp) {
                        propValCell = new PropTableCell("[binary]", valCellAttrs);
                    }
                    else {
                        propValCell = new PropTableCell(property.value, valCellAttrs);
                    }

                    let propTableRow = new PropTableRow({
                        className: "prop-table-row"
                    }, [propNameCell, propValCell])
                    propTable.addChild(propTableRow);

                } else {
                    console.log("Hiding property: " + property.name);
                }
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
    getNodeProperty = (propertyName: string, node: I.NodeInfo): I.PropertyInfo => {
        if (!node || !node.properties)
            return null;

        for (var i = 0; i < node.properties.length; i++) {
            let prop: I.PropertyInfo = node.properties[i];
            if (prop.name === propertyName) {
                return prop;
            }
        }
        return null;
    }

    getNodePropertyVal = (propertyName: string, node: I.NodeInfo): string => {
        let prop: I.PropertyInfo = this.getNodeProperty(propertyName, node);
        return prop ? prop.value : null;
    }

    /**
     * Sets property value and returns true only if the value has changed
     */
    setNodePropertyVal = (propertyName: string, node: I.NodeInfo, val: string): boolean => {
        let prop: I.PropertyInfo = this.getNodeProperty(propertyName, node);
        let ret = true;

        /* If we found a property by propertyName, then set it's value */
        if (prop != null) {
            ret = (prop.value !== val);
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
        return ret;
    }

    // /*
    //  * Returns trus if this is a node the current user doesn't own. Used to disable "edit", "delete",
    //  * etc. on the GUI.
    //  */
    // isNonOwnedNode = (node: I.NodeInfo): boolean => {
    //     let owner: string = node.owner;

    //     // if we don't know who owns this node assume the admin owns it.
    //     if (!owner) {
    //         owner = "admin";
    //     }

    //     return owner != meta64.userName;
    // }

    // not currently supporting the experimental 'comment nodes'
    // /*
    //  * Returns true if this is a comment node, that the current user doesn't own. Used to disable "edit", "delete",
    //  * etc. on the GUI.
    //  */
    // isNonOwnedCommentNode = (node: I.NodeInfo): boolean => {
    //     let commentBy: string = this.getNodePropertyVal(cnst.COMMENT_BY, node);
    //     return commentBy != null && commentBy != meta64.userName;
    // }

    // isOwnedCommentNode = (node: I.NodeInfo): boolean => {
    //     let commentBy: string = this.getNodePropertyVal(cnst.COMMENT_BY, node);
    //     return commentBy != null && commentBy == meta64.userName;
    // }

    /*
     * Returns Span representation of property value, even if multiple properties
     */
    renderProperty = (property: I.PropertyInfo): string => {
        let ret: string = null;

        /* if property is missing return empty string */
        if (!property.value || property.value.length == 0) {
            ret = "";
        }
        else {
            ret = property.value;
        }
        return ret || "";
    }
}

