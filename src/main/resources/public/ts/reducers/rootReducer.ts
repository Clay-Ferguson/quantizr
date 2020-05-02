import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { AppState } from "../AppState";
import { AppAction } from "../Interfaces";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

const initialState = new AppState();

/**
 * Takes a state as input, does the action on it, and returns the resulting new state.
 * 
 * @param state 
 * @param action 
 */
export function rootReducer(state: AppState = initialState, /* action: Action<any> */ action: AppAction) {

    console.log("Action: " + action.type);

    /* If this AppAction has function, then call it */
    if (action.func) {
        //action.func.bind(this);
        return action.func(state);
    }
    return state;
}