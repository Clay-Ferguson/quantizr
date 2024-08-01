import { useState } from "react";

/* 
Encapsulates the state of a component and provides by maintaining the state internally and also
allowing the ability to monitor state with the "onStateChange" callback. This is useful for
components that need to maintain state but also need to be able to monitor that state for changes 
*/
export class State<T> {
    state: T;
    onStateChange: (val: T) => void;

    // this is 'overridable/assignable' so that we have a way to monitor values as they get assigned
    // or even translate a value to some other value during assignment
    stateTranslator: (s: T) => T;

    constructor(initState: T) {
        this.state = initState || {} as T;
    }

    mergeState(moreState: T): void {
        const newState = { ...this.state, ...moreState };
        this.state = this.stateTranslator ? this.stateTranslator(newState) : newState;

        this.setStateEx((state: T) => {
            const newState = { ...state, ...moreState };
            return this.state = this.stateTranslator ? this.stateTranslator(newState) : newState;
        });
    }

    setState = (newState: T): void => {
        this.setStateEx((_state: T) => {
            // We wrap newState with curly braces to be sure we get an actual new object here
            return this.state = this.stateTranslator ? this.stateTranslator({ ...newState }) : { ...newState };
        });
    }

    /* We start out with this initial function which will allow us to set a state even before the
      'useState' has been called because for functional components (which we're using) the useState
      hook won't (and cannot) be even called ever until the react function itself is currently
      executing (per the "Rules of Hooks")
    */
    private setStateEx(state: (s?: T) => T): void {
        this.state = state(this.state);
        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    useState = () => {
        const [state, setStateEx] = useState(this.state);
        this.state = state;

        if (this.onStateChange) {
            this.setStateEx = (state: () => T) => {
                setStateEx(state);
                this.onStateChange(state());
            }
        }
        else {
            this.setStateEx = setStateEx.bind(this);
        }
    }
}
