import * as J from "./JavaIntf";
import { PropTable } from "./widget/PropTable";
import { PropTableRow } from "./widget/PropTableRow";
import { PropTableCell } from "./widget/PropTableCell";

import { PropsIntf } from "./intf/PropsIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C} from "./Constants";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Props implements PropsIntf {

    orderProps = (propOrder: string[], _props: J.PropertyInfo[]): J.PropertyInfo[] => {
        let propsNew: J.PropertyInfo[] = S.util.arrayClone(_props);
        let targetIdx: number = 0;

        for (let prop of propOrder) {
            targetIdx = this.moveNodePosition(propsNew, targetIdx, prop);
        }

        return propsNew;
    }

    moveNodePosition = (props: J.PropertyInfo[], idx: number, typeName: string): number => {
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
        for (let prop of propsList) {
            let tagIdx = S.util.arrayIndexOfItemByProp(props, "name", prop);
            if (tagIdx != -1) {
                S.util.arrayMoveItem(props, tagIdx, 0);
            }
        }
    }

    /* Moves all the properties listed in propList array to the end of the list of properties and keeps them in the order specified */
    private movePropsToEnd = (propsList: string[], props: J.PropertyInfo[]) => {
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
    renderProperties = (properties: J.PropertyInfo[]): PropTable => {
        if (properties) {
            let propTable = new PropTable({
                "border": "1",
                className: "property-table"
                // "sourceClass" : "[propsTable]"
            });

            properties.forEach((property: J.PropertyInfo) => {
                //console.log("Render Prop: "+property.name);
                if (S.render.allowPropertyToDisplay(property.name)) {
                    var isBinaryProp = S.render.isBinaryProperty(property.name);

                    let propNameCell = new PropTableCell(property.name /*S.render.sanitizePropertyName(property.name) */, {
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
    getNodeProp = (propertyName: string, node: J.NodeInfo): J.PropertyInfo => {
        if (!node || !node.properties)
            return null;

        for (var i = 0; i < node.properties.length; i++) {
            let prop: J.PropertyInfo = node.properties[i];
            if (prop.name === propertyName) {
                return prop;
            }
        }
        return null;
    }

    isEncrypted = (node: J.NodeInfo): boolean => {
        return !!S.props.getNodePropVal(J.NodeProp.ENC_KEY, node);
    }

    getNodePropVal = (propertyName: string, node: J.NodeInfo): string => {
        let prop: J.PropertyInfo = this.getNodeProp(propertyName, node);
        return prop ? prop.value : null;
    }

    /**
     * Sets property value and returns true only if the value has changed
     */
    setNodePropVal = (propertyName: string, node: J.NodeInfo, val: string): void => {
        let prop: J.PropertyInfo = this.getNodeProp(propertyName, node);

        /* If we found a property by propertyName, then set it's value */
        if (prop != null) {
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

