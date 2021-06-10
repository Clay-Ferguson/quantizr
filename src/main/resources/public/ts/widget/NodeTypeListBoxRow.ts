import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { FlexLayout } from "./FlexLayout";
import { Icon } from "./Icon";
import { ListBoxRow } from "./ListBoxRow";
import { Span } from "./Span";

/* NOTE: This class doesn't hold any state and is re-rendered when the state in the parent owning it is rendered. */
export class NodeTypeListBoxRow extends ListBoxRow {

    constructor(public typeHandler: TypeHandlerIntf, onClickFunc: Function, public isSelected: boolean) {
        super(null, onClickFunc);
    }

    preRender(): void {
        let icon: Icon = null;
        let iconClass = this.typeHandler.getIconClass();
        if (iconClass) {
            icon = new Icon({
                className: iconClass + " typeListIcon"
            });
        }

        this.setChildren([
            new FlexLayout([
                icon,
                new Span(this.typeHandler.getName())
            ], this.isSelected ? "selectedListItem" : "unselectedListItem")
        ]);
    }
}
