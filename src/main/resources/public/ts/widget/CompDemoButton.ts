import { useSelector } from "react-redux";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";
import { HorizontalLayout } from "./HorizontalLayout";

export class CompDemoButton extends Div {

    constructor(public idx: number) {
        super(null, {
            id: "CompDemoButton_id_" + idx,
            key: "CompDemoButton_key_" + idx
        });
        this.setStateEx({ counter: 0, idx: idx });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let cstate = this.getState();
        let children: CompIntf[] = [];

        children.push(new HorizontalLayout([
            new Div("Button " + cstate.idx + ": Inc CompDemo.state.counter=" + cstate.counter + " AppState.counter=" + state.counter, {
                className: "btn btn-primary" + (state.compDemoIdActive === cstate.idx ? " testHighlight" : ""),
                type: "button",
                onClick: () => {
                    Comp.renderCounter = 0;
                    // this.setStateEx({ counter: ++cstate.counter, cstate.idx });
                    this.mergeState({ counter: ++cstate.counter });

                    dispatch({
                        type: "Action_DemoAppIncCounter",
                        update: (s: AppState): AppState => {
                            s.compDemoIdActive = cstate.idx;
                            return { ...s };
                        }
                    });
                }
            })
        ]));

        this.setChildren(children);
    }
}
