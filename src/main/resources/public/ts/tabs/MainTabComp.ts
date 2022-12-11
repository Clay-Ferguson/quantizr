import { useAppState } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { BreadcrumbsPanel } from "../comp/BreadcrumbsPanel";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Html } from "../comp/core/Html";
import { NodeCompMainList } from "../comp/node/NodeCompMainList";
import { NodeCompMainNode } from "../comp/node/NodeCompMainNode";
import { NodeCompParentNodes } from "../comp/node/NodeCompParentNodes";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";

declare const g_brandingAppName: string;
declare const g_urlIdFailMsg: string;

export class MainTabComp extends AppTab {

    constructor(data: TabIntf) {
        super(data, null);
        this.attribs.key = "mainTabCompKey";
        data.inst = this;
    }

    preRender(): void {
        const ast = useAppState();
        this.attribs.className = this.getClass(ast);

        let contentDiv: Div = null;
        if (g_urlIdFailMsg) {
            contentDiv = new Div(g_urlIdFailMsg);
        }
        else if (!ast.node) {
            contentDiv = null;
        }
        else {
            // DO NOT DELETE (currently we have the 'show parents' button that ALWAYS needs to be available so we
            // will always render the BreadcrumbesPanel)
            // let renderableCrumbs = 0;
            // if (state.breadcrumbs) {
            //     state.breadcrumbs.forEach(bc => {
            //         if (bc.id !== state.node.id && bc.id !== state.userProfile.userNodeId) {
            //             renderableCrumbs++;
            //         }
            //     });
            // }

            contentDiv = new Div(null, {
                // This visibility setting makes the main content not visible until final scrolling is complete
                className: ast.rendering ? "compHidden" : "compVisible"
            }, [
                !ast.mobileMode ? new BreadcrumbsPanel() : null,
                ast.pageMessage ? new Html(ast.pageMessage, { className: "alert alert-info float-end" }) : null,
                ast.pageMessage ? new Clearfix() : null,

                // if we have some parents to display...
                ast.node.parents?.length > 0 ? new NodeCompParentNodes(ast, this.data) : null,

                new Div(null, { className: ast.userPrefs.editMode ? "my-tab-pane-editmode" : null }, [
                    new NodeCompMainNode(ast, this.data),
                    new NodeCompMainList(this.data)
                ])
            ]);
        }

        this.setChildren([
            new Div(null, { className: "headingBar" }, [
                new Div(g_brandingAppName, {
                    className: "tabTitle",
                    onClick: () => S.util.loadAnonPageHome(),
                    title: "Go to Portal Home Node"
                })
            ]),
            contentDiv
        ]);
    }
}
