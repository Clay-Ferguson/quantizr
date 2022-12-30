import { dispatch, useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Constants as C } from "../Constants";
import { FullScreenType } from "../Interfaces";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import * as J from "../JavaIntf";
import { Checkbox } from "./core/Checkbox";

// todo-1: This really needs to be part of the fullscreen viewer classes themselves since each one
// really might have a different version of this.
export class FullScreenControlBar extends Div {

    constructor() {
        super();
        this.attribs.className = "float-end fullScreenToolbar";
    }

    preRender(): void {
        this.setChildren(this.getButtons(useAppState()));
    }

    getButtons = (ast: AppState): Comp[] => {
        const buttons = [];

        if (ast.fullScreenConfig.type === FullScreenType.IMAGE && ast.activeTab === C.TAB_MAIN) {
            const node = S.nodeUtil.findNode(ast, ast.fullScreenConfig.nodeId);
            let onFirst = false;
            let onLast = false;
            if (node && node.attachments) {
                const list: J.Attachment[] = S.props.getOrderedAttachments(node);
                onFirst = list[0].o === ast.fullScreenConfig.ordinal;
                onLast = list[list.length - 1].o === ast.fullScreenConfig.ordinal;
            }

            if (!onFirst) {
                buttons.push(
                    new IconButton("fa-angle-left fa-lg", "", {
                        onClick: () => S.nav.prevFullScreenImgViewer(ast),
                        title: "View Previous Attachment"
                    }, "btn-primary", "off"));
            }

            if (!onLast) {
                buttons.push(
                    new IconButton("fa-angle-right fa-lg", "", {
                        onClick: () => S.nav.nextFullScreenImgViewer(ast),
                        title: "View Next Attachment"
                    }, "btn-primary", "off"));
            }
        }

        if (ast.fullScreenConfig.type === FullScreenType.GRAPH) {
            buttons.push(new Checkbox("Links", { title: "Show NodeLinks" }, {
                setValue: (checked: boolean) => {
                    dispatch("OpenDialog", s => {
                        s.showNodeLinksInGraph = checked;
                        return s;
                    });
                },
                getValue: (): boolean => ast.showNodeLinksInGraph
            }, "form-switch form-check-inline"));

            if (ast.showNodeLinksInGraph) {
                buttons.push(new Checkbox("Link Forces", { title: "NodeLinks Force Attractions" }, {
                    setValue: (checked: boolean) => {
                        dispatch("OpenDialog", s => {
                            s.attractionLinksInGraph = checked;
                            return s;
                        });
                    },
                    getValue: (): boolean => ast.attractionLinksInGraph
                }, "form-switch form-check-inline"));
            }
        }

        buttons.push(
            new IconButton("fa-window-close fa-lg", "Close", {
                onClick: () => S.nav.closeFullScreenViewer(ast),
                title: "Close Viewer (ESC Key)"
            }, "btn-primary", "off"));

        return buttons;
    }
}
