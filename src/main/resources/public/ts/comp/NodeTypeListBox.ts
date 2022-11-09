import { getAppState } from "../AppContext";
import { AppState } from "../AppState";
import { ValueIntf } from "../Interfaces";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { ListBox } from "./ListBox";
import { NodeTypeListBoxRow } from "./NodeTypeListBoxRow";

export class NodeTypeListBox extends ListBox {

    constructor(valueIntf: ValueIntf, public appState: AppState) {
        super(valueIntf);
    }

    preRender(): void {
        const children: Comp[] = [];
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
