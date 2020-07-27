import { ListBoxRow } from "./ListBoxRow";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ListBox } from "./ListBox";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { Icon } from "./Icon";
import { HorizontalLayout } from "./HorizontalLayout";
import { Span } from "./Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

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
                style: { marginRight: '12px', verticalAlign: 'middle' },
                className: iconClass
            });
        }

        this.setChildren([
            new HorizontalLayout([
                icon,
                new Span(this.typeHandler.getName())
            ], this.isSelected ? "selectedListItem" : "unselectedListItem")
        ]);
    }
}
