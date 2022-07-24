import { ReactNode } from "react";
import { store } from "../../AppRedux";
import { ValueIntf } from "../../Interfaces";
import { S } from "../../Singletons";
import { Comp } from "../base/Comp";
import { SelectionOption } from "./SelectionOption";

interface LS { // Local State
    value: string
}

export class Select extends Comp {
    constructor(attribs: any, public selectionOptions: Object[], private valueIntf: ValueIntf) {
        super(attribs);
        this.mergeState({ value: valueIntf.getValue() });
    }

    compRender = (): ReactNode => {
        this.setChildren(this.selectionOptions.map((row: any) => {
            // NOTE: for default selection we do it this way rather than the 'elm.selectedIndex' which is used to
            // to set selected item after rendered.
            return new SelectionOption(row.key, row.val);
        }));

        this.attribs.onChange = (evt: any) => {
            /*
             Special case here for mouseEffect: Selection change clicks don't have normal eventing we can use for the mouse animation so we just
             run it here an make it look like a click in the middle of the selection component, since this is done for supporting
             screencast demos this is actually much more clear anyway to display the animation on the actual selection after it's made
             */
            let state = store.getState();
            if (state.mouseEffect) {
                const { top, left } = evt.target.getBoundingClientRect();
                S.util.runClickAnimation(left + evt.target.offsetWidth / 2, top + evt.target.offsetHeight / 2);
            }

            this.valueIntf.setValue(evt.target.value);
            this.mergeState({ value: evt.target.value });
        };

        this.attribs.value = this.getState<LS>().value;
        return this.tag("select");
    }
}
