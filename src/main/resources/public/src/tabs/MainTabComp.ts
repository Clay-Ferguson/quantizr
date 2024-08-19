import { getAs } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Html } from "../comp/core/Html";
import { Icon } from "../comp/core/Icon";
import { IconButton } from "../comp/core/IconButton";
import { TabHeading } from "../comp/core/TabHeading";
import { NodeCompMainList } from "../comp/node/NodeCompMainList";
import { NodeCompMainNode } from "../comp/node/NodeCompMainNode";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";

export class MainTabComp extends AppTab<any, MainTabComp> {

    constructor(data: TabIntf<any, MainTabComp>) {
        super(data, null);
        this.attribs.key = "mainTabCompKey";
        data.inst = this;
    }

    override preRender = (): boolean => {
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
                ast.pageMessage ? new Html(ast.pageMessage, { className: "alert alert-info float-end" }) : null,
                ast.pageMessage ? new Clearfix() : null,

                // // if we have some parents to display...
                // ast.node.parents?.length > 0 ? new NodeCompParentNodes(this.data) : null,

                new Div(null, { className: ast.userPrefs.editMode ? "appTabPaneEditMode" : null }, [
                    new NodeCompMainNode(this.data),
                    pageNodeIsCut ? null : new NodeCompMainList(this.data)
                ])
            ]);
        }

        this.children = [
            !ast.node ? null : (this.headingBar = new TabHeading([
                new Div(null, { className: "float-end" }, [
                    // save screen space for mobile
                    !ast.mobileMode ? new Icon({
                        className: "fa fa-chevron-circle-left fa-lg buttonBarIcon",
                        title: "Previous Sibling Node",
                        onClick: S.nav.navToPrev
                    }) : null,

                    !ast.mobileMode ? new Icon({
                        className: "fa fa-chevron-circle-right fa-lg buttonBarIcon",
                        title: "Next Sibling Node",
                        [C.NODE_ID_ATTR]: ast.node.id,
                        onClick: S.nav.navToNext
                    }) : null,

                    S.nav.parentVisibleToUser() ?
                        new IconButton("fa-folder", "Up", {
                            [C.NODE_ID_ATTR]: ast.node.id,
                            onClick: S.nav.navUpLevelClick,
                            title: "Go to Parent Node"
                        }, "btn-primary") : null
                ]),
            ], this.data)),
            contentDiv
        ];
        return true;
    }
}
