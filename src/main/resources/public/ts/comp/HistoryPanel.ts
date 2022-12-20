import { useAppState } from "../AppContext";
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
                    const dragProps = ast.userPrefs.editMode ? {
                        onMouseOver: () => { S.quanta.draggableId = h.id; },
                        onMouseOut: () => { S.quanta.draggableId = null; }
                    } : {};

                    parentIcon = new Icon({
                        className: iconClass + " histTypeIcon",
                        title: "Node Type: " + type.getName(),
                        ...dragProps
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
        if (S.quanta.draggableId !== draggingId) {
            ev.preventDefault();
            return;
        }
        ev.target.style.border = "6px dotted green";
        ev.dataTransfer.setData("text", draggingId);
        ev.dataTransfer.setDragImage(S.quanta.dragImg, 0, 0);
    }

    dragEnd = (ev: any) => {
        ev.target.style.border = "6px solid transparent";
    }

    makeDropTarget = (attribs: any, id: string) => {
        S.domUtil.setDropHandler(attribs, true, (evt: DragEvent) => {
            // todo-2: right now we only actually support one file being dragged? Would be nice to support multiples
            for (const item of evt.dataTransfer.items) {
                // console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);

                if (item.kind === "string") {
                    item.getAsString(s => {
                        // console.log("String: " + s);
                        S.edit.moveNodeByDrop(id, s, "inside", true);
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
