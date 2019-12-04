console.log("Button.ts");

import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Button extends Comp {

    constructor(text: string, public callback: Function, _attribs: Object = null) {
        super(_attribs);
        S.util.mergeAndMixProps(this.attribs, {
            className: "btn btn-primary basicButton", /* also: secondary, info, success, danger, warning */
            type: "button"
        }, " ");

        this.attribs.onClick = callback;

        this.state = {
            text
        };
    }

    setText = (text: string) => {
        this.setState({
            text
        });
    }

    render = (p: any): React.ReactNode => {
        this.hookState(this.state);

        let icon;

        if (p.iconclass) {
            icon = S.e('i', { 
                className: p.iconclass,
                style: {
                    marginRight: "6px"
                }
            });
        }

        this.repairProps(p);

        let elm = S.e('button', p, [icon, this.state.text]);
        return elm;
    }
}
