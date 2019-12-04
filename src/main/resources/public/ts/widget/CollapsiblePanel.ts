console.log("Div.ts");

import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";

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

    render = (p: any) => {
        let style = this.textLink ? "" : "btn btn-info ";
        let innerStyle = this.textLink ? "file-link" : "";

        return S.e('div', {
            style: {margin: "10px"}
        },//
            S.e('a', {
                href: "#" + this.getId(),
                className: style,
                "data-toggle": "collapse"
            }, //
                S.e('div', {
                    className: innerStyle
                }, this.buttonText),
            ),
            S.e('div', {
                id: this.getId(),
                className: "collapse"
            },
                this.makeReactChildren()
            ));
    }
}

