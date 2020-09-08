
// let S: Singletons;
// PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
//     S = ctx;
// });

//todo-1: disabled for now.
// export class FolderTypeHandler implements TypeHandlerIntf {
//     constructor(private plugin: CoreTypesPlugin) {
//     }

//     render = (node: J.NodeInfo, rowStyling: boolean): Comp => {    
//         let ret: Comp = null;

//         let name = node.content;
//         if (name) {
//             ret = NodeCompMarkdown(node, {});
//         }
//         else {
//             let folderName = "";
//             let displayName = S.props.getNodePropVal("fs:link", node);
//             if (displayName) {
//                 folderName = node.name;
//             }

//             ret = new Heading(4, folderName, {
//                 className: "folder-link"
//             });
//         }

//         return ret;
//     }

//     orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[] {
//         return _props;
//     }

//     getIconClass(node: J.NodeInfo): string {
//         //https://www.w3schools.com/icons/fontawesome_icons_webapp.asp
//         return "fa fa-folder fa-lg";
//     }

//     allowAction(action: string): boolean {
//         return true;
//     }
// }
