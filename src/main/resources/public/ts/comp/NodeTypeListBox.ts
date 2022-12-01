import { getAppState } from "../AppContext";
import { AppState } from "../AppState";
import { ValueIntf } from "../Interfaces";
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
        const types = S.plugin.getAllTypeHandlers();

        types.forEach((type, k) => {
            if (getAppState().isAdminUser || type.getAllowUserSelect()) {
                children.push(new NodeTypeListBoxRow(type, () => {
                    this.updateVal(type.getTypeName());
                }, this.valueIntf.getValue() === type.getTypeName()));
            }
        });

        this.setChildren(children);
    }
}
