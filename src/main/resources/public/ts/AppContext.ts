import { createContext, useContext, useReducer } from "react";
import { AppState } from "./AppState";

/* Redux Replacement!!

We are dropping Redux and using useReducer instead,
because Redux is no longer needed, now that React can do that all the
state management we need and do it better than Redux. */

let state = new AppState();
let dispatcher: Function = null;

export const reducer = (state: AppState, action: any) => {
    return state = { ...action.payload(state) };
}

export const AppContext = createContext(state);

/* These methods will replace getAppState/useAppState after redux is removed
(todo-0: do we ever really need 'useCurState?' instead of just getCurState? */
export const getCurState = (): AppState => {
    return state;
}

/* Must be called from a react function */
export const useCurState = (): AppState => {
    return useContext(AppContext);
}

/* Must be called from the context of a running root level react function */
export function initDispatch(): void {
    [state, dispatcher] = useReducer(reducer, state);
}

export function dispatch(type: string, func: Function) {
    if (!dispatcher) {
        throw new Error("Dispatcher not ready.");
    }
    // console.log("Dispatch: " + actionName);
    const startTime = new Date().getTime();
    dispatcher({ type, payload: func });
    console.log("act: " + type + " " + (new Date().getTime() - startTime) + "ms");
}
