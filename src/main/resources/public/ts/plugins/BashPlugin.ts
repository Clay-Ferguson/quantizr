
// todo-1: temporarily disabling
// class BashTypeHandler implements TypeHandlerIntf {
//     constructor(private bashPlugin : BashPlugin) {
//     }

//     render = (node: J.NodeInfo, rowStyling: boolean): Comp => {
//         //let content: string = S.props.getNodePropVal(Constants.CONTENT, node);
//         let name = S.props.getNodePropVal(C.NAME, node);
//         if (!name) {
//             name = "[no sn:name prop]";
//         }
//         let vertLayout = new VerticalLayout([
//             // I decided it's better not to display the actual script, here but this code would do that. We could use a collapsable panel
//             // like the FileType does.
//             // new Pre(content, {
//             //     "className":
//             //         "bash-script " +
//             //         "col-sm-10 " +
//             //         "col-md-10" +
//             //         "col-lg-10 " +
//             //         "col-xl-10 "
//             // }),
//             new Button(name, () => { this.bashPlugin.executeNodeButton(node) }, {
//                 className: "bash-exec-button"
//             }),
//         ]);
//         return vertLayout;
//     }

//     orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[] {
//         return _props;
//     }

//     getIconClass(node : J.NodeInfo): string {
//         return null;
//     }

//     allowAction(action : string): boolean {
//         return true;
//     }
// }

// export class BashPlugin implements BashPluginIntf {
//     bashTypeHandler : TypeHandlerIntf = new BashTypeHandler(this);

//     init = () => {
//         S.plugin.addTypeHandler("bash", this.bashTypeHandler);
//     }

//     executeNodeButton = (node: J.NodeInfo): void => {
//         S.util.ajax<J.ExecuteNodeRequest, J.ExecuteNodeResponse>("executeNode", {
//             "nodeId": node.id,
//         }, this.executeNodeResponse);
//     }

//     private executeNodeResponse = (res: J.ExecuteNodeResponse): void => {
//         console.log("ExecuteNodeResponse running.");

//         S.util.checkSuccess("Execute Node", res);

//         //for now not showing a message after. So the scripting can basically just be used to launch an app
//         //or something like that where they don't care to see any output.
//         //S.util.showMessage(res.output, true, "modal-lg");

//         // S.view.refreshTree(null, false);
//         // S.meta64.selectTab("mainTab");
//         // S.view.scrollToSelectedNode(null);
//     }
// }
