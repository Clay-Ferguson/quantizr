import { getAppState, useAppState } from "../AppContext";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Icon } from "../comp/core/Icon";
import { Span } from "../comp/core/Span";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";

export class HistoryPanel extends Div {

    constructor() {
        super(null, {
            id: C.ID_RHS + "_hist",
            className: "nodeHistoryPanel"
        });
    }

    preRender(): void {
        const ast = useAppState();

        if (S.quanta.nodeHistory.length === 0) {
            this.setChildren(null);
            return;
        }
        const children = [];
        children.push(new Div(null, null, [
            new Span("History", { className: "historyPanelTitle" }),
            new Checkbox("Lock", { className: "lockFont marginBottom float-end" }, {
                setValue: (checked: boolean) => S.quanta.nodeHistoryLocked = checked,
                getValue: (): boolean => S.quanta.nodeHistoryLocked
            }, "form-switch form-check-inline-nomargin")
        ]));

        S.quanta.nodeHistory.forEach(h => {
            if (!h.content) return;
            let parentDropTarg: CompIntf;
            let parentIcon: Icon;

            const type = S.plugin.getType(h.type);
            if (type) {
                const iconClass = type.getIconClass();
                if (iconClass) {
                    parentIcon = new Icon({
                        className: iconClass + " histTypeIcon",
                        title: "Node Type: " + type.getName()
                    });
                }
            }

            const dragProps = ast.userPrefs.editMode ? {
                draggable: "true",
                onDragStart: (evt: any) => this.dragStart(evt, h.id),
                onDragEnd: this.dragEnd
            } : {};

            children.push(parentDropTarg = new Div(null, {
                id: h.id + "_hist",
                nid: h.id,
                onClick: this.jumpToId,
                className: "nodeHistoryItem",
                ...dragProps
            }, [
                parentIcon,
                new Span(h.content, null, null, true)
            ]));

            S.domUtil.makeDropTarget(parentDropTarg, h.id);
        });
        this.setChildren(children);
    }

    dragStart = (ev: any, draggingId: string) => {
        // don't allow drag while editing.
        if (getAppState().editNode) return;

        ev.currentTarget.classList.add("dragBorderSource");
        S.quanta.dragElm = ev.target;
        S.quanta.draggingId = draggingId;

        ev.dataTransfer.setData(C.DND_TYPE_NODEID, draggingId); // was "text" type
        ev.dataTransfer.setDragImage(S.quanta.dragImg, 0, 0);
    }

    dragEnd = (ev: any) => {
        ev.currentTarget.classList.remove("dragBorderSource");
        S.quanta.dragElm = null;
    }

    /* We use the standard trick of storing the ID on the dom so we can avoid unnecessary function scopes */
    jumpToId = (evt: any) => {
        const id = S.domUtil.getPropFromDom(evt, "nid");
        PubSub.pub(C.PUBSUB_closeNavPanel);
        S.view.jumpToId(id);
    }
}
