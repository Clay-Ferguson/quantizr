import { getAs } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { Comp, CompT } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Html } from "../comp/core/Html";
import { Icon } from "../comp/core/Icon";
import { TabHeading } from "../comp/core/TabHeading";
import { NodeCompMainList } from "../comp/node/NodeCompMainList";
import { NodeCompMainNode } from "../comp/node/NodeCompMainNode";
import { Constants as C } from "../Constants";
import { TabBase } from "../intf/TabBase";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";

export class TreeView extends AppTab<any, TreeView> {

    constructor(data: TabBase<any, TreeView>) {
        super(data, null);
        this.attribs.key = "treeViewKey";
        data.inst = this;
    }

    override preRender(): boolean | null | CompT[] {
        const ast = getAs();

        let contentDiv: Comp = null;
        if (!ast.node) {
            contentDiv = null;
        }
        else {
            const pageNodeIsCut = ast.cutCopyOp === "cut" && ast.nodesToMove && ast.nodesToMove.find(id => id === ast.node.id);

            contentDiv = new Div(null, {
                // This visibility setting makes the main content not visible until final scrolling is complete
                className: ast.rendering ? "compHidden" : "compVisible"
            }, [
                // !ast.mobileMode ? new BreadcrumbsPanel(this.data.props?.breadcrumbs) : null,
                ast.pageMessage ? new Html(ast.pageMessage, { className: Tailwind.alertInfo + " float-right" }) : null,
                ast.pageMessage ? new Clearfix() : null,

                // // if we have some parents to display...
                // ast.node.parents?.length > 0 ? new NodeCompParentNodes(this.data) : null,

                new Div(null, { className: ast.userPrefs.editMode ? "appTabPaneEditMode" : null }, [
                    new NodeCompMainNode(this.data),
                    pageNodeIsCut ? null : new NodeCompMainList(this.data)
                ])
            ]);
        }

        const isRootNode = ast.node.path === "/r";
        const parentVisible = S.nav.parentVisibleToUser();

        if (ast.node && ((!ast.mobileMode && !isRootNode) || parentVisible)) {
            const headingBarItems = [];

            if (!ast.isAnonUser && !ast.mobileMode) {
                headingBarItems.push(new Icon({
                    className: "fa fa-search fa-lg buttonBarIcon",
                    title: "Search under this Node",
                    onClick: S.srch._openSearchDlg
                }));
                headingBarItems.push(new Icon({
                    className: "fa fa-timeline fa-lg buttonBarIcon",
                    title: "Timeline under this Node",
                    onClick: S.srch._timeline
                }));

                if (!isRootNode) {
                    headingBarItems.push(new Icon({
                        className: "fa fa-chevron-circle-left fa-lg buttonBarIcon",
                        title: "Previous Sibling Node",
                        onClick: S.nav._navToPrev
                    }));
                    headingBarItems.push(new Icon({
                        className: "fa fa-chevron-circle-right fa-lg buttonBarIcon",
                        title: "Next Sibling Node",
                        [C.NODE_ID_ATTR]: ast.node.id,
                        onClick: S.nav._navToNext
                    }));
                }
            }

            if (parentVisible) {
                headingBarItems.push(new Button("Up", S.nav._navUpLevelClick, {
                    [C.NODE_ID_ATTR]: ast.node.id,
                    title: "Go to Parent Node"
                }, "-primary", "fa-folder"));
            }

            if (headingBarItems.length > 0) {
                this.headingBar = new TabHeading([
                    new Div(null, { className: "float-right" }, headingBarItems),
                ], this.data);
            }
            else {
                if (!this.attribs.className)
                    this.attribs.className = "";
                this.attribs.className += " pt-6";
            }
        }
        this.children = [this.headingBar, contentDiv];
        return true;
    }
}
