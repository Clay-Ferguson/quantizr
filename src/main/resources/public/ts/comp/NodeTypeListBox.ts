import { getAs } from "../AppContext";
import { AppState } from "../AppState";
import { ValueIntf } from "../Interfaces";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { ListBox } from "./ListBox";
import { NodeTypeListBoxRow } from "./NodeTypeListBoxRow";

export class NodeTypeListBox extends ListBox {

    constructor(valueIntf: ValueIntf, public ast: AppState) {
        super(valueIntf);

        const maxHeight: number = window.innerHeight > 300 ? (window.innerHeight * 0.7) : 300;
        this.attribs.className = "scrollY scrollBorder customScrollbar";
        this.attribs.style = { maxHeight: maxHeight + "px" };
    }

    preRender(): void {
        const children: Comp[] = [];
        const types = S.plugin.getAllTypes();

        types.forEach((type, k) => {
            if (getAs().isAdminUser || type.getAllowUserSelect()) {
                children.push(new NodeTypeListBoxRow(type, () => {
                    this.updateVal(type.getTypeName());
                }, this.valueIntf.getValue() === type.getTypeName()));
            }
        });

        this.setChildren(children);
    }
}
