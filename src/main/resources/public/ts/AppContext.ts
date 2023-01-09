import { createContext, useContext, useReducer } from "react";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { PubSub } from "./PubSub";

/* Redux Replacement!!

We are dropping Redux and using useReducer+useContext instead,
because Redux is no longer needed, now that React can do that all the
state management we need and do it better (i.e. simpler) than Redux. */

/* NOTE: dispatcher doesn't get set until the root component calls initDispatch WHILE BEING
 rendered. This is a requirement becasue it comes from useReducer which can only be called
 inside a react function */

// todo-0: * rename 'payload' to func.
//         * add interface for "{type: func}"
//         * stop requiring func to RETURN anything. It's never needed

let dispatcher: Function = null;

export let state = new AppState();
export const AppContext = createContext(state);

/* Our architecture is to always have the payload as a function, and do that pattern everywhere */
export function reducer(s: AppState, action: any) {
    state = { ...action.payload(s) };
    return state;
}

/* Use this to get state when NOT inside a react function */
export function getAppState(s: AppState = null): AppState {
    return s || state;
}

/* Must be called from a react function */
export function useAppState(): AppState {
    state = useContext(AppContext);
    return state;
}

/**
 * Must be called from the context of a running root level react function, and should be called only once by
 * a top level component.
 */
export function initDispatch(): void {
    [state, dispatcher] = useReducer(reducer, state);
    PubSub.pub(C.PUBSUB_dispatcherReady);
}

/**
 * Simple dispatch to transform state. When using this you have no way, however, to wait for
 * the state transform to complete, so use the 'promiseDispatch' for that. Our design pattern is to
 * always do state changes (dispatches) only thru this 'dispatcher', local to this module, and we also
 * allow a function to be passed, rather than an object payload.
 */
export function dispatch(type: string, func: (s: AppState) => AppState) {
    if (!dispatcher) {
        throw new Error("Called dispatch before first render. type: " + type);
    }
    dispatcher({ type, payload: func });
}

/**
 * Schedules a dispatch to run, and returns a promise that will resolve only AFTER the state
 * change has completed.
 */
export function promiseDispatch(type: string, func: (s: AppState) => AppState): Promise<AppState> {
    return new Promise<AppState>(async (resolve, reject) => {
        if (!dispatcher) {
            throw new Error("Called dispatch before first render. type: " + type);
        }
        dispatcher({
            type, payload: function (s: AppState): AppState {
                const state = func(s);
                resolve(state);
                return state;
            }
        });
    });
}
