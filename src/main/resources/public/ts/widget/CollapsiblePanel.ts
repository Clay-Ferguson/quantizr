import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class CollapsiblePanel extends Comp {

    /* If textLink=true that means we show just a text link and not a button */
    constructor(private buttonText: string = "", attribs: Object = {}, initialChildren: Comp[] = null, private textLink: boolean = false) {
        super(attribs);
        this.setChildren(initialChildren);
    }

    compRender = (p: any): ReactNode => {
        let style = this.textLink ? "" : "btn btn-info ";
        let innerStyle = this.textLink ? "file-link" : "";

        return S.e('div', {
            style: {marginTop: "10px", marginBottom: "10px"},
            key: "div_"+this.getId()
        },//
            S.e('a', {
                href: "#" + this.getId(),
                className: style,
                "data-toggle": "collapse",
                key: "div_a_"+this.getId()
            }, //
                S.e('div', {
                    className: innerStyle,
                    key: "div_a_div_"+this.getId()
                }, this.buttonText),
            ),
            S.e('div', {
                id: this.getId(),
                className: "collapse",
                key: "div_div_d"+this.getId()
            },
                this.makeReactChildren()
            ));
    }
}

