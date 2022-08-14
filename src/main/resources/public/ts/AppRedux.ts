import { useSelector } from "react-redux";
import { createStore } from "redux";
import { AppState } from "./AppState";
import { AppAction } from "./Interfaces";

/**
 * Takes a state as input, does the action on it, and returns the resulting new state.
 */
export function rootReducer(state: AppState, action: AppAction) {
    state = state || new AppState();

    // console.log("Action: " + action.type);
    if (action.update) {
        // These 'update' function may or may not actually use the 'state' parameter we pass in here, because sometimes
        // we get the state and then start making updates to it in several different places and in cases like that
        // calls to this 'update' will use the state on the stack at that time, and not use the 'state' parameter here
        // because it's own state will be known to be the correct up to date state in those circumstances.
        state = { ...action.update(state) };
    }
    return state;
}

export const store = createStore(rootReducer);

export const getAppState = (state?: AppState): AppState => {
    return state ? state : store.getState();
};

export const useAppState = (state?: AppState): AppState => {
    return state || useSelector((s: AppState) => s);
};

// NOTE: This dispatch is synchronous (not asynchronous)
export const dispatch = (actionName: string, update: (state: AppState) => AppState) => {
    // console.log("Dispatch: " + actionName);
    const startTime = new Date().getTime();
    store.dispatch({ type: actionName, update });
    console.log("act: " + actionName + " " + (new Date().getTime() - startTime) + "ms");
};

/* This listener is temporary until I find a better way to do this code, which needs to always run after any
render is complete and AFTER the html DOM is updated/final

This works, but is currently not needed.
*/
// const handleChange = () => {
//     // console.log("AppRedux change.");
// };
// store.subscribe(handleChange);
// const unsubscribe = store.subscribe(handleChange);
// unsubscribe()
