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
        //todo-0: If this is called too early 'setState' can be null. Need to fix.
        this.setState({
            text
        });
    }

    render = (p: any): React.ReactNode => {
        this.hookState(this.state);
        p = this.attribs;

        let icon: any;

        if (p.iconclass) {
            icon = S.e('i', { 
                key: "s_"+this.getId(),
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
