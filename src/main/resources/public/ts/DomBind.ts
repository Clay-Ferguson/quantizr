console.log("DomBind.ts");

import { DomBindIntf } from "./intf/DomBindIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
    s.domBind.init();
});

/*
This allows us to wire a function to a particular Element by its ID even BEFORE the ID itself comes into existence
on the DOM 
*/
export class DomBind implements DomBindIntf {
    private static DELIMITER = ".";
    private counter: number = 0;
    private initialized: boolean = false;

    constructor() {
        //console.log("DomBind Constructor");
    }

    public init = () => {
        if (this.initialized) return;
        this.initialized = true;

        setInterval(() => {
            this.interval();
        }, 250);

        // The MutationObserver is never getting called even though I have subtree=true on is, 
        // which is baffeling to me, but i'll just have to rely on the setInterval timer instead which
        // acually is not bad performance.
        // let timer = setInterval(() => {
        //     if (document.getElementById("x-app")) {
        //         clearInterval(timer);
        //         this.initMutationObserver();
        //     }
        // }, 500);
    }

    /* Binds DOM IDs to functions that should be called, once the DOM ID comes into existence. Note the keys are not unique per-dom-id, so that multiple different 
    functions can be attached to all execute once the element is detected to exist. */
    private idToFuncMap: { [key: string]: Function } = {};

    // WARNING: Don't delete this, because we will probably eventually need it.
    // private initMutationObserver = (): void => {
    //     // select the target node
    //     let target = document.getElementById("x-app");

    //     // create an observer instance
    //     let observer = new MutationObserver((mutations) => {
    //         console.log("Mutation Detected.");
    //         this.interval();
    //         // mutations.forEach(function (mutation) {
    //         //     console.log(mutation.type);
    //         // });
    //     });

    //     // configuration of the observer:
    //     let config = { subtree: true, attributes: false, childList: true, characterData: false };

    //     // pass in the target node, as well as the observer options
    //     observer.observe(target, config);

    //     // later, you can stop observing
    //     //observer.disconnect();
    // }

    private interval = (): void => {
        if (!S.util) {
            //console.log("util module not yet loaded.");
            return;
        }

        /* The loop below may have multiple entries targeting the same element, so just to avoid as many DOM operations
        as possible (for performance) we cache them in this map once we find them */
        let idToElmMap: { [key: string]: HTMLElement } = {};

        let lookups = 0;
        let keysToDelete = [];

        S.util.forEachProp(this.idToFuncMap, (key: string, func: Function): boolean => {
            lookups++;
            //console.log("LOOKUP: key=" + key);
            let id = S.util.chopAtLastChar(key, DomBind.DELIMITER);

            //console.log("LOOKUP: id[" + id + "]");

            //first try to get from map, which will find them in there only if already encountered
            //this same ID in this loop we are now in.
            let e = idToElmMap[id];

            //if not in map look in actual DOM itself.
            if (!e) {
                e = S.util.domElm(id);
            }

            //if we found the element here, we run the associated function, and add the key to the
            //list to be cleaned up (deleted)
            if (e) {
                //console.log("DomBind " + id + " FOUND.");
                this.idToFuncMap[key](e);
                keysToDelete.push(key);
            }
            else {
                //todo-1: periorically uncomment to see if anything is showing up here
                //console.log("DomBind " + id + " waiting...");
            }
            return true;
        });

        for (let key in keysToDelete) {
            delete this.idToFuncMap[keysToDelete[key]];
        }

        if (lookups > 0) {
            //console.log("DomBind Lookups=" + lookups);
        }
    }

    // todo-0: need to make this use promises instead of callbacks.
    public whenElm = (domId: string, callback: Function) => {

        if (S.util.startsWith(domId, "#")) {
            console.log("whenElm removed obsolete preceding # from ID " + domId);
            domId = domId.substring(1);
        }

        /* First try to find the domId immediately and if found run the function */
        let e = S.util.domElm(domId);
        if (e) {
            callback(e);
            return;
        }

        /* Otherwise we setup into the timer loop, to process whenever the element comes into existence */
        this.idToFuncMap[domId + DomBind.DELIMITER + (++this.counter)] = callback;
    }
}
