import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";
import { TabPanel } from "./TabPanel";
import { MainNavPanel } from "./MainNavPanel";
import { Div } from "./Div";
import { Main } from "./Main";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class App extends Comp {

    tabPanel: TabPanel = null;

    constructor(attribs: Object = {}) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        this.setChildren([
            new Div(null, { role: "toolbar" }, [new MainNavPanel(null)]),
            new Main({ role: "main", className: "container" }, [
                this.tabPanel || (this.tabPanel = new TabPanel())
            ])
        ]);

        return this.tagRender('div', null, this.attribs);
    }
}
