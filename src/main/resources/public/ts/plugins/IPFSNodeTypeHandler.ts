import * as J from "../JavaIntf";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

//todo-1: disabled for now

// export class IPFSNodeTypeHandler implements TypeHandlerIntf {
//     constructor(private plugin: CoreTypesPlugin) {
//     }

//     render = (node: J.NodeInfo, rowStyling: boolean): Comp => {
//         let ret: Comp[] = [];

//         let name = node.content;
//         if (name) {
//             let linkName = S.props.getNodePropVal("ipfs:linkName", node);
//             if (linkName) {
//                 ret.push(new Heading(6, "Link Name: " + linkName, { className: "ipfs-text" }));
//             }

//             let link = S.props.getNodePropVal("ipfs:link", node);
//             if (link) {
//                 ret.push(new Heading(6, "Link: " + link, { className: "ipfs-text" }));
//             }
//             ret.push(S.render.renderMarkdown(rowStyling, node, {}));
//         }
//         else {
//             let displayName = S.props.getNodePropVal("ipfs:link", node);
//             // let folderName = "";
//             // let displayName = S.props.getNodePropVal("ipfs:link", node);
//             // if (displayName) {
//             //     folderName = S.util.getNameFromPath(displayName);
//             // }

//             ret.push(new Heading(6, "Link: " + displayName, { className: "ipfs-text" }));
//         }

//         return new Div(null, null, ret);
//     }

//     orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[] {
//         return _props;
//     }

//     getIconClass(node: J.NodeInfo): string {
//         //https://www.w3schools.com/icons/fontawesome_icons_webapp.asp
//         return "fa fa-sitemap fa-lg";
//     }

//     allowAction(action: string): boolean {
//         return true;
//     }
// }


