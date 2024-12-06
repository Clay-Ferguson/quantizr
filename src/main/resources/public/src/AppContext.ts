import { createContext, useReducer } from "react";
import { AppState } from "./AppState";
import { S } from "./Singletons";

/* Redux Replacement!!

We are dropping Redux and using useReducer+createContext instead, because Redux is no longer needed,
now that React can do that all the state management we need and do it better (i.e. simpler) than
Redux.

NOTE: dispatcher doesn't get set until the root component calls initDispatch WHILE BEING rendered.
This is a requirement because it comes from useReducer which can only be called inside a react
function */
let dispatcher: (o: { type: string, func: (s: AppState) => any }) => void = null;

export let state = new AppState();
export const AppContext: React.Context<AppState> = createContext(state);
export type StateModFunc = (s: AppState) => any;

interface DispatchData {
    type: string;
    func: StateModFunc;
}
let dispatchLaterList: DispatchData[] = [];

function reducer(s: AppState, action: DispatchData) {
    const saveState = s;
    try {
        const newState = { ...s };

        // ============================
        // WARNING!!!! Normally dispatch methods return NOTHING, and so returning exactly 'false' is
        // the only case we need to detect here. Do not change this to handle any "falsy" type
        // because that will break the entire app.
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
        S.util.logErr(e, "(State rolled back)");
        return saveState;
    }
}

export function getAs(): AppState {
    // Freeze this object because it's always a violation of our architecural design to ever have an
    // object gotten from getAs() be modified.
    return Object.freeze(state);
}

/**
 * Must be called from the context of a running root level react function, and should be called only
 * once by a top level component.
 */
export function initDispatch(): void {
    [state, dispatcher] = useReducer(reducer, state);
}

export function dispatcherReady(): boolean {
    return dispatcher !== null;
}

export function asyncDispatch(type: string, func: StateModFunc) {
    setTimeout(() => {
        dispatch(type, func);
    }, 10);
}

/**
 * Simple dispatch to transform state. When using this you have no way, however, to wait for the
 * state transform to complete, so use the 'promiseDispatch' for that. Our design pattern is to
 * always do state changes (dispatches) only thru this 'dispatcher', local to this module
 */
export function dispatch(type: string, func: StateModFunc, dispatchLater: boolean = false) {
    // console.log("DISP: " + type);
    if (!dispatcher) {
        throw new Error("Called dispatch before initDispatch. type: " + type);
    }

    if (dispatchLater) {
        dispatchLaterList.push({ type, func });
    }
    else {
        // dispatch any pending actions first.
        dispatchLaterList.forEach(d => dispatcher(d));
        dispatchLaterList = [];
        dispatcher({ type, func });
    }
}

/**
 * Schedules a dispatch to run, and returns a promise that will resolve only AFTER the state change
 * has completed. We accomplish this simply by wrapping 'func' in a new function that we can inject
 * the reject/resolve into, to be sure we've waited at least until the state has transformed.
 */
export function promiseDispatch(type: string, func: StateModFunc): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (!dispatcher) {
            throw new Error("Called promiseDispatch before initDispatch. type: " + type);
        }

        dispatcher({
            type, func: function (s: AppState): any {
                // ============================
                // WARNING!!!! Normally dispatch methods return NOTHING, and so returning exactly
                // 'false' is the only case we need to detect here. Do not change this to handle any
                // "falsy" type because that will break the entier app.
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
