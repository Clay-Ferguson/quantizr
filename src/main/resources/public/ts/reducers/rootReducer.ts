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

    /* If this AppAction has 'updateNew' use it to get the new state */
    if (action.updateNew) {
        state = action.updateNew(state);
    }
    /* If this AppAction has 'update' use it to update existing state */
    else if (action.update) {
        action.update(state);
    }

    return state;
}