import { useAppState } from "../AppRedux";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Icon } from "../comp/core/Icon";
import { Span } from "../comp/core/Span";
import { Constants as C } from "../Constants";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { NodeHistoryItem } from "../NodeHistoryItem";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";

export class HistoryPanel extends Div {
    private static MAX_SUBITEMS = 5;

    constructor() {
        super(null, {
            id: C.ID_RHS + "_hist",
            className: "nodeHistoryPanel"
        });
    }

    preRender(): void {
        let state = useAppState();

        if (S.quanta.nodeHistory.length === 0) {
            this.setChildren(null);
            return;
        }
        let children = [];
        children.push(new Div(null, null, [
            new Checkbox("Lock", { className: "lockFont marginBottom float-end" }, {
                setValue: (checked: boolean) => {
                    S.quanta.nodeHistoryLocked = checked;
                },
                getValue: (): boolean => {
                    return S.quanta.nodeHistoryLocked;
                }
            }, "form-switch form-check-inline")
        ]));

        S.quanta.nodeHistory.forEach((h: NodeHistoryItem) => {
            if (!h.content) return;
            let parentDropTarg: CompIntf;
            let parentIcon: Icon;

            let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(h.type);
            if (typeHandler) {
                let iconClass = typeHandler.getIconClass();
                if (iconClass) {
                    let dragProps = state.userPreferences.editMode ? {
                        onMouseOver: () => { S.quanta.draggableId = h.id; },
                        onMouseOut: () => { S.quanta.draggableId = null; }
                    } : {};

                    parentIcon = new Icon({
                        className: iconClass + " rowTypeIcon",
                        title: "Node Type: " + typeHandler.getName(),
                        ...dragProps
                    });
                }
            }

            let dragProps = state.userPreferences.editMode ? {
                draggable: "true",
                onDragStart: (evt) => this.dragStart(evt, h.id),
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

            if (h.subItems) {
                let count = 0;
                let dotsShown = false;

                // we include topLevelId in the ids below so the React 'key' (same as id, by default) isn't
                // ever able to be duplilcated, because that throws a warning in React.
                let topLevelId = h.id;

                h.subItems.forEach((h: NodeHistoryItem) => {
                    if (!h.content || dotsShown) return;
                    if (count++ < HistoryPanel.MAX_SUBITEMS) {
                        let dropTarg: Div;
                        let icon: Icon;

                        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(h.type);
                        if (typeHandler) {
                            let iconClass = typeHandler.getIconClass();
                            if (iconClass) {
                                let dragProps = state.userPreferences.editMode ? {
                                    onMouseOver: () => { S.quanta.draggableId = h.id; },
                                    onMouseOut: () => { S.quanta.draggableId = null; }
                                } : {};

                                icon = new Icon({
                                    className: iconClass + " rowTypeIcon",
                                    title: "Node Type: " + typeHandler.getName(),
                                    ...dragProps
                                });
                            }
                        }

                        let dragProps = state.userPreferences.editMode ? {
                            draggable: "true",
                            onDragStart: (evt) => this.dragStart(evt, h.id),
                            onDragEnd: this.dragEnd
                        } : {};

                        children.push(dropTarg = new Div(null, {
                            className: "nodeHistorySubItem",
                            id: topLevelId + "_" + h.id + "_subhist",
                            nid: h.id,
                            onClick: this.jumpToId,
                            ...dragProps
                        }, [
                            icon,
                            new Span(h.content, null, null, true)
                        ]));

                        this.makeDropTarget(dropTarg.attribs, h.id);
                    }
                    else {
                        if (!dotsShown) {
                            dotsShown = true;
                            children.push(new Div("...", {
                                id: topLevelId + "_" + h.id + "_subhist",
                                className: "nodeHistorySubItemDots"
                            }));
                        }
                    }
                });
            }
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
    }

    dragEnd = (ev) => {
        ev.target.style.border = "6px solid transparent";
    }

    makeDropTarget = (attribs: any, id: string) => {
        S.util.setDropHandler(attribs, true, (evt: DragEvent) => {
            const data = evt.dataTransfer.items;

            // todo-2: right now we only actually support one file being dragged? Would be nice to support multiples
            for (let i = 0; i < data.length; i++) {
                const d = data[i];
                // console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);

                if (d.kind === "string") {
                    d.getAsString((s) => {
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
        let id = S.domUtil.getPropFromDom(evt, "nid");
        S.view.jumpToId(id);
    }
}
