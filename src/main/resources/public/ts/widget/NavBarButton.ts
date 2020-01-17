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

    compRender = (): ReactNode => {
        let state = this.getState();
        //console.log("compRender " + this.jsClassName + "(" + this.content + ") state to visible=" + state.visible);
        //todo-0: for now if someething's disabled we just hide it, but eventually we'll put back in the logic
        //for enablement logic as found in Comp base class.
        let _style = { display: (state.visible && !state.disabled ? '' : 'none') };

        //we have to create a clone for sending to S.e, because React has a rule that once it renders the object
        //then becomes readonly
        let _attribs = { ...this.attribs, ...{ style: _style } };

        return S.e('button', _attribs,
            S.e("i", {
                key: "s_"+this.getId(),
                className: "fa fa-lg button-font",
            }, this.content, true)
        );
    }
}
