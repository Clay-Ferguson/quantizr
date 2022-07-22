import { useState } from "react";

export class State {
    state: any = {};

    // this is 'overridable/assignable' so that we have a way to monitor values as they get assigned
    // or even translate a value to some other value during assignment
    stateTranslator = (s: any): any => {
        return s;
    }

    mergeState<ST>(moreState: ST): any {
        this.setStateEx((state: any) => {
            this.state = { ...state, ...moreState };
            return this.stateTranslator(this.state);
        });
    }

    setState = <ST>(newState: ST): any => {
        this.setStateEx((state: any) => {
            return this.state = this.stateTranslator({ ...newState });
        });
    }

    /* We start out with this initial function which will allow us to set a state even before the 'useState' has been called
      because for functional components (which we're using) the useState hook won't (and cannot) be even called ever until
      the react function itself is currently executing. One of the "Rules of Hooks"
    */
    setStateEx<ST>(state: ST) {
        if (!state) {
            state = {} as ST;
        }
        if (typeof state === "function") {
            this.state = state(this.state);
        }
        else {
            this.state = state;
        }
    }

    useState = () => {
        const [state, setStateEx] = useState(this.state);
        this.state = state;

        // Yes, this is a bit odd but correct. We override our default setStateEx method here with the one
        // react provides us for state management, now that react state management is going into effect.
        this.setStateEx = setStateEx.bind(this);
    }

    // todo-1: this is an ugly oddball method. Can we get rid of this? 
    updateVisAndEnablement = () => {
        if (this.state.enabled === undefined) {
            this.state.enabled = true;
        }

        if (this.state.visible === undefined) {
            this.state.visible = true;
        }
    }
}
