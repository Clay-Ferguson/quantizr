import { getAs } from "../../AppContext";
import { Constants as C } from "../../Constants";
import { PubSub } from "../../PubSub";
import { Comp } from "../base/Comp";

export class AppNavLink extends Comp {
    constructor(content: string = "", func: () => void, moreClasses: string = "") {
        super(null);
        this.attribs.className = (getAs().mobileMode ? "tabSubOptionsItemMobile" : "tabSubOptionsItem") + " " + moreClasses;
        this.attribs.onClick = () => {
            PubSub.pub(C.PUBSUB_closeNavPanel);
            func();
        }
        this.content = content;
    }
}
