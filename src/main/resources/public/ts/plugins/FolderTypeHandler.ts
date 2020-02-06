import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { CoreTypesPlugin } from "./CoreTypesPlugin";
import { Comp } from "../widget/base/Comp";
import { Heading } from "../widget/Heading";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FolderTypeHandler implements TypeHandlerIntf {
    constructor(private plugin: CoreTypesPlugin) {
    }

    render = (node: J.NodeInfo, rowStyling: boolean): Comp => {    
        let ret: Comp = null;

        let name = node.content;
        if (name) {
            ret = S.render.renderMarkdown(rowStyling, node, {});
        }
        else {
            let folderName = "";
            let displayName = S.props.getNodePropertyVal("fs:link", node);
            if (displayName) {
                folderName = node.name;
            }

            ret = new Heading(4, folderName, {
                className: "folder-link"
            });
        }

        return ret;
    }

    orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[] {
        return _props;
    }

    getIconClass(node: J.NodeInfo): string {
        //https://www.w3schools.com/icons/fontawesome_icons_webapp.asp
        return "fa fa-folder fa-lg";
    }

    allowAction(action: string): boolean {
        return true;
    }
}

