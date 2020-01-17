import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { SelectionOption } from "./SelectionOption";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Selection extends Comp {

    constructor(attribs: any, public selectionOptions: Object[] = null) {
        super(attribs || {});
        this.attribs.className = "custom-select w-25 m-3";
        selectionOptions.forEach((row: Object) => {
            if (row['selected']) {
                this.attribs.selection = row['key'];
            }
            this.children.push(new SelectionOption(row['key'], row['val']));
        });
    }

    getSelection = (): string => {
        let elm: HTMLSelectElement = this.getElement() as HTMLSelectElement;
        if (!elm) {
            console.error("getSelection called on element "+this.jsClassName+" before it existed.")
            return null;
        }
        return elm.options[elm.selectedIndex].value;
    }

    setSelection = (key: string) => {
        this.whenElm((elm: HTMLSelectElement) => {
            let idx = -1;
            this.children.forEach((row: SelectionOption) => {
                idx++;
                if (row.key == key) {
                    //let elm: HTMLSelectElement = this.getElement() as HTMLSelectElement;
                    elm.selectedIndex = idx;
                }
            });
        });
    }

    compRender = (): ReactNode => {
        return this.tagRender('select', null, this.attribs);
    }
}
