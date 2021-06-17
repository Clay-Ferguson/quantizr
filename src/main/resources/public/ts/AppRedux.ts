import { useSelector } from "react-redux";
import { createStore } from "redux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { AppAction } from "./Interfaces";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

export const initialState = new AppState();

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

/**
 * Takes a state as input, does the action on it, and returns the resulting new state.
 */
export function rootReducer(state: AppState = initialState, /* action: Action<any> */ action: AppAction) {

    if (!state) {
        console.error("rootReducer called with null state: " + action);
        return null;
    }

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

/* For syntactical sugar we allow a state to get passed or not */
export const appState = (state?: AppState): AppState => {
    return state || store.getState();
};

export const useAppState = (state?: AppState): AppState => {
    return state || useSelector((s: AppState) => s);
};

export const dispatch = (actionName: string, update: (state: AppState) => AppState) => {
    // console.log("Dispatch Running: " + actionName);
    store.dispatch({ type: actionName, update });
    // Log.log("Dispatch Complete: " + action.type);
};

/* This listener is temporary until I find a better way to do this code, which needs to always run after any
render is complete and AFTER the html DOM is updated/final

This works, but is currently not needed.
*/
const handleChange = () => {
    // console.log("AppRedux change.");
};

store.subscribe(handleChange);
// const unsubscribe = store.subscribe(handleChange);
// unsubscribe()
