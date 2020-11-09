import { useState } from "react";

export class State<S> {
    state: any = {};

    mergeState(moreState: any): any {
        this.setStateEx((state: any) => {
            this.state = { ...state, ...moreState };
            return this.state;
        });
    }

    setState = (newState: any): any => {
        this.setStateEx((state: any) => {
            return this.state = { ...newState };
        });
    }

    setStateEx(state: any) {
        if (!state) {
            state = {};
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
        this.setStateEx = setStateEx.bind(this);
    }
}
