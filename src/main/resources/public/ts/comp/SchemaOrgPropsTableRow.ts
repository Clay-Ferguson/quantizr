import { SchemaOrgProp } from "../JavaIntf";
import { Div } from "./core/Div";
import { ListBoxRow } from "./ListBoxRow";

export class SchemaOrgPropsTableRow extends ListBoxRow {

    constructor(public prop: SchemaOrgProp) {
        super(null, null, null);
        this.attribs.className = "propListItem";
    }

    preRender(): void {
        this.setChildren([
            new Div(null, null, [
                // DO NOT DELETE (We'll eventually want to have this, to select properties)
                // this.selectableRows ? new Checkbox(null, { className: "propsListItemCheckBox" }, {
                //     setValue: (checked: boolean) => {
                //         const state: EditPropertyDlgState = this.dlg.getState();
                //         if (checked) {
                //             state.selections.add(this.friend.userName);
                //         }
                //         else {
                //             state.selections.delete(this.friend.userName);
                //         }
                //         this.dlg.mergeState(state);
                //     },
                //     getValue: (): boolean => false // this.dlg.getState().selections.has(this.friend.userName)
                // }) : null,
                new Div(this.prop.label, { className: "propNameInList" })
            ])
        ]);
    }
}
