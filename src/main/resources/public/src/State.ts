import { Dispatch, SetStateAction, useState } from "react";

/* 
Encapsulates the state of a component and allows the ability to monitor state with the "onStateChange" 
callback, as well as support for setting a custom state translation function, that can preProcess state changes. 
This is useful for components that need to maintain state but also need to be able to monitor that state for changes.
*/
export class State<T> {
    private state: T;
    private reactStateSetter: Dispatch<SetStateAction<T>>;

    onStateChange: (val: T) => void;
    stateTranslator: (s: T) => T;

    constructor(initState: T) {
        // The app always expects state to not ever be null so initialize to empty object as needed
        this.state = initState || {} as T;
    }

    mergeState = (moreState: T): void => {
        // Note: It's required to create a brand new object here
        this.stateChange({ ...this.state, ...moreState });
    }

    setState = (newState: T): void => {
        // Note: It's required to create a brand new object here
        this.stateChange({ ...newState });
    }

    // NOTE: It's assumed that a brand new state object is being passed in here
    private stateChange = (newState: T) => {
        // translate the newState into 'this.state'
        this.state = this.stateTranslator ? this.stateTranslator(newState) : newState;

        // Once a react render has been triggered, the reactStateSetter will be set
        if (this.reactStateSetter) {
            this.reactStateSetter(this.state);
        }

        // Notify the onStateChange callback if it's been set
        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    useState() {
        [this.state, this.reactStateSetter] = useState(this.state);
    }

    getState() {
        return this.state;
    }
}
