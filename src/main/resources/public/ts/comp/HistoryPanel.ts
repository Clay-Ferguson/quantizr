import { useAppState } from "../AppContext";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Icon } from "../comp/core/Icon";
import { Span } from "../comp/core/Span";
import { Constants as C } from "../Constants";
import { ConfirmDlg } from "../dlg/ConfirmDlg";
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
            new Checkbox("Lock", { className: "lockFont marginBottom float-end" }, {
                setValue: (checked: boolean) => S.quanta.nodeHistoryLocked = checked,
                getValue: (): boolean => S.quanta.nodeHistoryLocked
            }, "form-switch form-check-inline")
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

            this.makeDropTarget(parentDropTarg.attribs, h.id);

        });
        this.setChildren(children);
    }

    dragStart = (ev: any, draggingId: string) => {
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

    makeDropTarget = (attribs: any, id: string) => {
        S.domUtil.setDropHandler(attribs, (evt: DragEvent) => {
            // todo-2: right now we only actually support one file being dragged? Would be nice to support multiples
            for (const item of evt.dataTransfer.items) {
                // console.log("DROP(b) kind=" + item.kind + " type=" + item.type);

                if (item.type === C.DND_TYPE_NODEID && item.kind === "string") {
                    item.getAsString(async (s) => {
                        // console.log("String: " + s);
                        const dlg = new ConfirmDlg("Move nodes(s)?", "Confirm Move",
                            "btn-primary", "alert alert-info");
                        await dlg.open();
                        if (dlg.yes) {
                            S.edit.moveNodeByDrop(id, s, "inside");
                        }
                    });
                    return;
                }
            }
        });
    }

    /* We use the standard trick of storing the ID on the dom so we can avoid unnecessary function scopes */
    jumpToId = (evt: any) => {
        const id = S.domUtil.getPropFromDom(evt, "nid");
        PubSub.pub(C.PUBSUB_closeNavPanel);
        S.view.jumpToId(id);
    }
}
