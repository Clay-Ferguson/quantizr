import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});


export class NavBarButton extends Comp {

    constructor(public content: string = "", attribs: Object = {}, private _isEnabledFunc: Function=null, private _isVisibleFunc: Function=null) {
        super(attribs);
        this.attribs.type = "button"; 
        this.attribs.className = "btn nav-link align-middle btn-primary small-margin-right";
        this.setIsEnabledFunc(_isEnabledFunc);
        this.setIsVisibleFunc(_isVisibleFunc);
    }

    compRender = (p: any): ReactNode => {
        return S.e('button', p,
            S.e("i", {
                key: "s_"+this.getId(),
                className: "fa fa-lg button-font",
            }, this.content, true)
        );
    }
}
