import { getAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { ValueIntf } from "../Interfaces";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { S } from "../Singletons";
import { ListBox } from "./ListBox";
import { NodeTypeListBoxRow } from "./NodeTypeListBoxRow";

export class NodeTypeListBox extends ListBox {

    constructor(valueIntf: ValueIntf, public appState: AppState) {
        super(valueIntf);

        // todo-1: react re-renders aren't persisting scroll position across renders, so we probably
        // should invent a "Scrollable" class we can derive from or put content into, which encapsulates the
        // capability to persist scroll? Or better yet don't even use any inheritance, and make ANY div
        // be able to setup listeners on it that will persist it across renders. We have some other hacks
        // related to our main window components that tackle this but not in a reusable way. Make it all consistent.
        // this.attribs.className = "height-75vh vert-scroll";
    }

    preRender(): void {
        const children = [];
        const typeHandlers = S.plugin.getAllTypeHandlers();

        typeHandlers.forEach((typeHandler: TypeHandlerIntf, k: string): boolean => {
            if (getAppState().isAdminUser || typeHandler.getAllowUserSelect()) {
                children.push(new NodeTypeListBoxRow(typeHandler, () => {
                    this.updateVal(typeHandler.getTypeName());
                }, this.valueIntf.getValue() === typeHandler.getTypeName()));
            }
            return true;
        });

        this.setChildren(children);
    }
}
