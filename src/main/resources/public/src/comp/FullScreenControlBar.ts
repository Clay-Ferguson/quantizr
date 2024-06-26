import { dispatch, getAs } from "../AppContext";
import { Constants as C } from "../Constants";
import { FullScreenType } from "../Interfaces";
import { Attachment } from "../JavaIntf";
import { S } from "../Singletons";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Selection } from "../comp/core/Selection";
import { FullScreenGraphViewer } from "./FullScreenGraphViewer";
import { Comp } from "./base/Comp";
import { ButtonBar } from "./core/ButtonBar";
import { Checkbox } from "./core/Checkbox";
import { CollapsiblePanel } from "./core/CollapsiblePanel";

// todo-2: This really needs to be part of the fullscreen viewer classes themselves since each one
// really might have a different version of this.
export class FullScreenControlBar extends Div {

    constructor() {
        super();
        this.attribs.className = "float-end fullScreenToolbar";
    }

    override preRender = (): boolean => {
        this.setChildren(this.getComps());
        return true;
    }

    getComps = (): Comp[] => {
        const ast = getAs();
        const comps = [];
        const buttons = [];

        if (ast.fullScreenConfig.type === FullScreenType.IMAGE && ast.activeTab === C.TAB_MAIN) {
            const node = S.nodeUtil.findNode(ast.fullScreenConfig.nodeId);
            let onFirst = false;
            let onLast = false;
            if (node && node.attachments) {
                const list: Attachment[] = S.props.getOrderedAtts(node);

                if (list.length > 1) {
                    onFirst = (list[0].o || 0) === ast.fullScreenConfig.ordinal;
                    onLast = (list[list.length - 1].o || 0) === ast.fullScreenConfig.ordinal;
                }
            }

            if (!onFirst) {
                buttons.push(
                    new IconButton("fa-angle-left fa-lg", "", {
                        onClick: S.nav.prevFullScreenImgViewer,
                        title: "View Previous Attachment"
                    }, "btn-primary", "off"));
            }

            if (!onLast) {
                buttons.push(
                    new IconButton("fa-angle-right fa-lg", "", {
                        onClick: S.nav.nextFullScreenImgViewer,
                        title: "View Next Attachment"
                    }, "btn-primary", "off"));
            }
        }

        if (ast.fullScreenConfig.type === FullScreenType.GRAPH) {
            comps.push(new CollapsiblePanel("More", "Less", null, [
                new Selection(null, null, [
                    { key: "constant", val: "Constant" },
                    { key: "linear", val: "Linear" },
                    { key: "quadratic", val: "Quadratic" },
                    { key: "cubic", val: "Cubic" }
                ], null, "selectPowerFactorDropDown", {
                    setValue: (val: string) => {
                        dispatch("setPowerFactor", s => {
                            FullScreenGraphViewer.reset();
                            s.graphPowerFactor = val;
                        });
                    },
                    getValue: (): string => getAs().graphPowerFactor
                }),
                new Checkbox("Links", { title: "Show NodeLinks" }, {
                    setValue: (checked: boolean) => {
                        dispatch("setShowNodeLinks", s => {
                            FullScreenGraphViewer.reset();
                            s.showNodeLinksInGraph = checked;
                        });
                    },
                    getValue: (): boolean => ast.showNodeLinksInGraph
                }, "form-switch form-check-inline"),
                ast.showNodeLinksInGraph ? new Checkbox("Forces", { title: "NodeLinks Force Attractions" }, {
                    setValue: (checked: boolean) => {
                        dispatch("setLinkForces", s => {
                            FullScreenGraphViewer.reset();
                            s.attractionLinksInGraph = checked;
                        });
                    },
                    getValue: (): boolean => ast.attractionLinksInGraph
                }, "form-switch form-check-inline") : null
            ], true, (exp: boolean) => {
                dispatch("ExpandFullScreenControls", s => {
                    s.fullScreenControlsExpanded = exp;
                });
            }, ast.fullScreenControlsExpanded, "inlineBlock", "inlineBlock", null, "div"));

            buttons.push(
                new IconButton("fa-window-minimize fa-lg", null, {
                    onClick: S.nav.minimizeFullScreenViewer,
                    title: "Minimize Graph"
                }, "btn-primary", "off"));
        }

        buttons.push(
            new IconButton("fa-window-close fa-lg", null, {
                onClick: S.nav.closeFullScreenViewer,
                title: "Close Viewer (ESC Key)"
            }, "btn-primary", "off"));

        if (buttons.length > 0) {
            comps.push(new ButtonBar(buttons, "float-end"));
        }

        return comps;
    }
}
