import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class NavBarIconButton extends Comp {

    constructor(public iconClass: string = "", public text: string, attribs: Object = {}, private _isEnabledFunc: Function = null, private _isVisibleFunc: Function = null) {
        super(attribs);
        this.attribs.type = "button";
        this.attribs.className = "btn nav-link align-middle btn-primary small-margin-right";
        this.setIsEnabledFunc(_isEnabledFunc);
        this.setIsVisibleFunc(_isVisibleFunc);
    }

    render = (p: any) => {
        this.repairProps(p);
        return S.e('button', p,
            S.e("i", {
                className: "fa fa-lg " + this.iconClass,
            }, [
                S.e('span', {className: 'button-font'}, this.text == null ? null : " " + this.text)
            ], true)
        );
    }
}
