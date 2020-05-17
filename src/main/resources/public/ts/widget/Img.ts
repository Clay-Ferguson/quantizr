import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Img extends Comp {

    constructor(private key: string, attribs : Object = {}) {
        super(attribs);
    }

    compRender(): ReactNode {
        let expandedImages = useSelector((state: AppState) => state.expandedImages);

        //console.log("Render IMG: id="+this.getId());
        if (this.key && expandedImages[this.key]) {
            this.attribs.style = this.attribs.style || {};
            this.attribs.style.maxWidth = "calc(100% - 12px)";
            this.attribs.style.width = "calc(100% - 12px)";
        }

        return S.e("img", this.attribs);
    }
}
