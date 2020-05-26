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

export class NodeTypeListBoxRow extends ListBoxRow {

    constructor(listBox: ListBox, public typeHandler: TypeHandlerIntf) { 
        super(listBox, null, typeHandler.getTypeName(), listBox.isSelectedFunc);
    }

    preRender(): void {
        super.preRender();
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
            ])
        ]);
    }
}
