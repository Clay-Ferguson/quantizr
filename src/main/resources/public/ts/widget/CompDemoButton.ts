import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "./Div";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";
import { dispatch } from "../AppRedux";
import { CompIntf } from "./base/CompIntf";
import { HorizontalLayout } from "./HorizontalLayout";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class CompDemoButton extends Div {

    constructor(public idx: number) {
        super(null, {
            id: "CompDemoButton_id_" + idx,
            key: "CompDemoButton_key_" + idx,
        });
        this.setStateEx({ counter: 0, idx: idx });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let cstate = this.getState();

        let children: CompIntf[] = [];

        children.push(new HorizontalLayout([
            new Div("Button " + cstate.idx + ": Inc CompDemo.state.counter=" + cstate.counter + " AppState.counter=" + state.counter, {
                className: "btn btn-primary" + (state.compDemoIdActive == cstate.idx ? " redBorder": ""), 
                type: "button",
                onClick: () => {
                    Comp.renderCounter = 0;
                    //this.setStateEx({ counter: ++cstate.counter, cstate.idx });
                    this.mergeState({ counter: ++cstate.counter });

                    dispatch({
                        type: "Action_DemoAppIncCounter", state,
                        update: (s: AppState): void => {
                            s.compDemoIdActive = cstate.idx;
                        },
                    });
                }
            })
        ]));

        this.setChildren(children);
    }

    /* Return an object such that, if this object changes, we must render, or else we don't need to render */
    makeCacheKeyObj = (appState: AppState, state: any, props: any) => {
        state = this.getState();
        return {
            appStateCounter: appState.counter,
            stateCounter: state.counter,
            props,
            compDemoIdActive: appState.compDemoIdActive
        };
    }
}
