import { dispatch, getAs } from "../AppContext";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Icon } from "../comp/core/Icon";
import { Span } from "../comp/core/Span";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { SpanHtml } from "./core/SpanHtml";

export class HistoryPanel extends Div {

    constructor() {
        super(null, {
            id: C.ID_RHS + "_hist",
            className: "nodeHistoryPanel"
        });
    }

    static historyLockChanged = (checked: boolean) => {
        dispatch("historyLockChanged", s => s.nodeHistoryLocked = checked)
    }

    override preRender = (): boolean => {
        const ast = getAs();

        if (ast.nodeHistory.length === 0) {
            this.children = null;
            return;
        }
        const children = [];
        children.push(new Div(null, null, [
            new Span("History", { className: "historyPanelTitle" }),
            new Span("Clear", {
                className: "clickable",
                onClick: S.histUtil.clearHistory
            }),
            new Checkbox("Lock", { className: "lockFont marginBottom float-end" }, {
                setValue: HistoryPanel.historyLockChanged,
                getValue: (): boolean => ast.nodeHistoryLocked
            }, "form-switch formCheckInlineNoMargin")
        ]));

        ast.nodeHistory.forEach(h => {
            if (!h.content) return;
            let parentDropTarg: Comp;
            let histIcon: Icon;

            const type = S.plugin.getType(h.type);
            if (type) {
                const iconClass = type.getIconClass();
                if (iconClass) {
                    histIcon = new Icon({
                        id: h.id + "_histIcon",
                        className: iconClass + " histTypeIcon",
                        title: "Node Type: " + type.getName()
                    });
                }
            }

            const dragProps = {};
            if (!ast.mobileMode && ast.userPrefs.editMode && !ast.editNode) {
                S.domUtil.setNodeDragHandler(dragProps, h.id);
            }

            children.push(parentDropTarg = new Div(null, {
                id: h.id + "_hist",
                [C.NODE_ID_ATTR]: h.id,
                onClick: this.jumpToId,
                className: "nodeHistoryItem",
                ...dragProps
            }, [
                histIcon,
                new SpanHtml(h.content, { id: h.id + "_histCont" })
            ]));

            if (!ast.mobileMode) {
                S.domUtil.makeDropTarget(parentDropTarg.attribs, h.id);
            }
        });
        this.children = children;
        return true;
    }

    /* We use the standard trick of storing the ID on the dom so we can avoid unnecessary function scopes */
    jumpToId = (evt: any) => {
        const id = S.domUtil.getPropFromDom(evt, C.NODE_ID_ATTR);
        PubSub.pub(C.PUBSUB_closeNavPanel);
        S.view.jumpToId(id);
    }
}
