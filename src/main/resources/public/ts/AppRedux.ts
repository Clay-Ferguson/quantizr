import { AppState } from "./AppState";
import { AppAction } from "./Interfaces";
import { createStore } from 'redux';

const initialState = new AppState();

/**
 * Takes a state as input, does the action on it, and returns the resulting new state.
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

export const store = createStore(rootReducer);

export let dispatch = (action: AppAction) => {
    store.dispatch(action);
}
