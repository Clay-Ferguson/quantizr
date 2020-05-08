import { AppState } from "./AppState";
import { AppAction } from "./Interfaces";
import { createStore } from 'redux';
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";

declare var MathJax;

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export const initialState = new AppState();

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

        /* todo-0: this line is a stop-gap because for now our 'sensitivity' for re-renders needs to be ANYTHING in the state 
        can trigger everything to rerender. This line will go away once we have the ability to have the useSelector() calls
        in each component be smart enough to only retrieve exactly what's needed, which will speed up rendering a lot, and once
        we have that this line can be removed. This line is forcing react to see we have a whole new state and can trigger
        re-render of everything in that state 
        
        todo-0: Related to this is the fact that when this massive full state change happens it triggers TabPanel also to render, and 
        that blows up because the active tab currently can only be controled by click which is bad. need active tab to come from STATE variable.
        */
        state = { ...state };
    }

    /* If this action wants us to update it's own copy of a 'state' do that here */
    if (action.state) {
        Object.assign(action.state, state);
    }

    return state;
}

export const store = createStore(rootReducer);

export let dispatch = (action: AppAction) => {
    store.dispatch(action);
}

/* This listener is temporary until I find a better way to do this code, which needs to always run after any
render is complete and AFTER the html DOM is updated/final */
const handleChange = () => {
    setTimeout(() => {

        /* todo-1: This should be altered to search ONLY inside the DIVs that we know we are altering (markdown? rows?) */
        S.util.forEachElmBySel("a", (el, i) => {
            el.setAttribute("target", "_blank");
        });

        // todo-0: disabling this becasue it causes page to go blank where the math formua is before displaying the fomrmula
        // and so until I find a way to have MathJax render up front on first render, i won't be using it for now.
        // maybe the memo feature of react can come to my aid here somehow? to cache things.
        // if (MathJax && MathJax.typeset) {
        //     //note: MathJax.typesetPromise(), also exists
        //     MathJax.typeset();
        // }
    }, 250);
}

const unsubscribe = store.subscribe(handleChange);
// unsubscribe()
