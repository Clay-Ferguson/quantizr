import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPrivsTable extends Comp {

    constructor(public content: string = "", attribs : Object = {}) {
        super(attribs);
        //let width = window.innerWidth * 0.6;
        //let height = window.innerHeight * 0.4;
        //(<any>this.attribs).style = `width:${width}px;height:${height}px;overflow:scroll;border:4px solid lightGray;`;
        this.setClass("list-group");
    }

    compRender = (p: any) => {
        return this.tagRender('div', null, p);
    }
}
