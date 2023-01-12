import { createContext, useContext, useReducer } from "react";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { PubSub } from "./PubSub";

/* Redux Replacement!!

We are dropping Redux and using useReducer+useContext instead,
because Redux is no longer needed, now that React can do that all the
state management we need and do it better (i.e. simpler) than Redux.

NOTE: dispatcher doesn't get set until the root component calls initDispatch WHILE BEING
rendered. This is a requirement becasue it comes from useReducer which can only be called
inside a react function */

let dispatcher: Function = null;

export let state = new AppState();
export const AppContext = createContext(state);
export type StateModFunc = (s: AppState) => any;

function reducer(s: AppState, action: any) {
    const saveState = s;
    try {
        const newState = { ...s };

        // ============================
        // WARNING!!!! Normally dispatch methods return NOTHING, and so returning exactly 'false' is the only
        // case we need to detect here. Do not change this to handle any "falsy" type becasue that will
        // break the entier app.
        // ============================
        if (action.func(newState) === false) {
            // if func itself requested rollback, then rollback
            return saveState;
        }
        state = newState;
        return state;
    }
    // if an error happens we can rollback the state to exactly what it was before (saveState)
    catch (e) {
        console.error(e.message + "(State rolled back)", e.stack);
        return saveState;
    }
}

export function getAs(): AppState {
    // Freeze this object because it's always a violation of our architecural design
    // to ever have an object gotten from getAs() be modified.
    return Object.freeze(state);
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
 * always do state changes (dispatches) only thru this 'dispatcher', local to this module
 */
export function dispatch(type: string, func: StateModFunc) {
    if (!dispatcher) {
        throw new Error("Called dispatch before first render. type: " + type);
    }
    dispatcher({ type, func });
}

/**
 * Schedules a dispatch to run, and returns a promise that will resolve only AFTER the state
 * change has completed. We accomplish this simply by wrapping 'func' in a new function
 * that we can inject the reject/resolve into, to be sure we've waited at least until
 * the state has transformed.
 */
export function promiseDispatch(type: string, func: StateModFunc): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
        if (!dispatcher) {
            throw new Error("Called dispatch before first render. type: " + type);
        }
        dispatcher({
            type, func: function (s: AppState): any {
                // ============================
                // WARNING!!!! Normally dispatch methods return NOTHING, and so returning exactly 'false' is the only
                // case we need to detect here. Do not change this to handle any "falsy" type becasue that will
                // break the entier app.
                // ============================
                if (func(s) === false) {
                    reject();
                }
                else {
                    resolve();
                }
            }
        });
    });
}
