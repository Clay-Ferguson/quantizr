import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "./Div";
import { Button } from "./Button";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";
import { dispatch } from "../AppRedux";
import { CompDemo } from "./CompDemo";
import { HorizontalLayout } from "./HorizontalLayout";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class AppDemo extends Div {

    constructor() {
        super();
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.setChildren([
            new HorizontalLayout([
                new Button("Inc AppState.counter=" + state.counter + " compDemoIdActive=" + state.compDemoIdActive, () => {
                    Comp.renderCounter = 0;
                    dispatch({
                        type: "Action_DemoAppIncCounter", state,
                        update: (s: AppState): void => {
                            s.counter++;
                        },
                    });
                })
            ]),

            new HorizontalLayout([
                new CompDemo()
            ])
        ]);
    }
}
