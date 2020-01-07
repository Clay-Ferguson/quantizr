import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Icon extends Comp {

    constructor(public text: string, public callback: Function, _attribs: Object = null) {
        super(_attribs);
        // S.util.mergeProps(this.attribs, {
        //     //"className": "fa fa-file", //"btn btn-primary basicButton", /* also: secondary, info, success, danger, warning */
        //     //"type": "button"
        // });

        //i'm just blowing this away during a refactor. I don't think it was used.
        // if (!initiallyVisible) {
        //     (<any>this.attribs).style = "display:none;"
        // }

        this.attribs.onClick = callback;
    }

    compRender = (p: any): ReactNode => {
        return S.e('i', p, null);
    }

    // render_Html = (): string => {
    //     // let iElm;
    //     // if ((<any>this).attribs.iconClass) {
    //     //    // <i className="fa fa-home fa-lg"/>
    //     //    iElm = S.tag.i({className: (<any>this).attribs.iconClass});
    //     // }
    //     // let content = this.text ? this.text : "";
    //     // if (iElm) {
    //     //     content = iElm + content;
    //     // }
    //     return S.tag.i(this.attribs, null);
    // }
}
