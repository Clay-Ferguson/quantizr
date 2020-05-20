import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class CollapsiblePanel extends Comp {

    /* If textLink=true that means we show just a text link and not a button */
    constructor(private buttonText: string = "", attribs: Object = {}, initialChildren: Comp[] = null, private textLink: boolean = false,
        private stateCallback: Function = null, expanded: boolean = false, private extraToggleButtonClass="") {
        super(attribs);
        this.setChildren(initialChildren);
        this.state.expanded = expanded;
    }

    setExpanded(expanded: boolean) {
        this.mergeState({expanded});
    }

    compRender(): ReactNode {
        let style = this.textLink ? "" : "btn btn-info ";
        let innerStyle = this.textLink ? "file-link" : "";
        let collapseClass = this.getState().expanded ? "expand" : "collapse";

        return S.e('div', {
            style: { marginTop: "10px", marginBottom: "10px" },
            key: "div_" + this.getId()
        },//
            S.e('a', {
                href: "#" + this.getId(),
                className: style+" "+this.extraToggleButtonClass,
                "data-toggle": collapseClass,
                id: "div_a_" + this.getId(),
                key: "div_a_" + this.getId(),
                onClick: this._onToggle
            }, //
                S.e('span', {
                    className: innerStyle,
                    key: "div_a_div_" + this.getId()
                }, this.buttonText),
            ),
            S.e('div', {
                id: this.getId(),
                className: collapseClass,
                key: "div_div_d" + this.getId()
            },
                this.buildChildren()
            ));
    }

    _onToggle = (): void => {
        let expanded = !this.getState().expanded;
        this.setExpanded(expanded);
        if (this.stateCallback) {
            this.stateCallback(expanded);
        }
    }
}

