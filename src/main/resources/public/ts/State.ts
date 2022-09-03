import { useState } from "react";

export class State {
    state: any = {};

    // this is 'overridable/assignable' so that we have a way to monitor values as they get assigned
    // or even translate a value to some other value during assignment
    stateTranslator = (s: any): any => {
        return s;
    }

    mergeState<T>(moreState: T): void {
        this.setStateEx((state: any) => {
            return this.state = this.stateTranslator({ ...state, ...moreState });
        });
    }

    setState = <T>(newState: T): void => {
        this.setStateEx((state: any) => {
            return this.state = this.stateTranslator({ ...newState });
        });
    }

    /* We start out with this initial function which will allow us to set a state even before the 'useState' has been called
      because for functional components (which we're using) the useState hook won't (and cannot) be even called ever until
      the react function itself is currently executing (per the "Rules of Hooks")
    */
    private setStateEx(state: Function) {
        this.state = state(this.state);
    }

    useState = () => {
        const [state, setStateEx] = useState(this.state);
        this.state = state;

        // Yes, this is a bit odd but correct. We override our default setStateEx method here with the one
        // react provides us for state management, now that react state management is going into effect.
        this.setStateEx = setStateEx.bind(this);
    }
}
