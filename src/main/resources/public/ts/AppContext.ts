import { createContext, useContext, useReducer } from "react";
import { AppState } from "./AppState";

/* Redux Replacement!!

We are dropping Redux and using useReducer+useContext instead,
because Redux is no longer needed, now that React can do that all the
state management we need and do it better (i.e. simpler) than Redux. */

/* NOTE: dispatcher doesn't get set until the root component calls initDispatch WHILE BEING
 rendered. This is a requirement becasue it comes from useReducer which can only be called
 inside a react function */
let dispatcher: Function = null;

export let state = new AppState();
export const AppContext = createContext(state);

/* Our architecture is to always have the payload as a function, and do that pattern everywhere */
export function reducer(s: AppState, action: any) {
    return state = { ...action.payload(s) };
}

/* Use this to get state when NOT inside a react function */
export function getAppState(s: AppState = null): AppState {
    return s || state;
}

/* Must be called from a react function */
export function useAppState(): AppState {
    return state = useContext(AppContext);
}

/* Must be called from the context of a running root level react function */
export function initDispatch(): void {
    [state, dispatcher] = useReducer(reducer, state);
}

export function dispatch(type: string, func: (s: AppState) => AppState) {
    // console.log("Dispatch: " + type);
    if (!dispatcher) {
        throw new Error("Called dispatch before first render. type: " + type);
    }
    const startTime = new Date().getTime();
    dispatcher({ type, payload: func });
    console.log("act: " + type + " " + (new Date().getTime() - startTime) + "ms");
}

export function getDispatcher() {
    return dispatcher;
}
