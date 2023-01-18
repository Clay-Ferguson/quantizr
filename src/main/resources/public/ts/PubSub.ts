/* Basic Pub/Sub Implementation */

export class PubSub {

    // functions that will keep firing every time the pub event is published
    // (each element holds an array of functions)
    private static registry: Object = {};

    // functions that are a fire-and-forget that fire once and never again
    // (each element holds an array of functions)
    private static registryOnce: Object = {};

    // allows only ONE function at a time to subscribe to any given event. Last sub overrides any previous or pending ones
    // (each element holds a function, not an array)
    private static registrySingleOnce: Object = {};

    private static lastFires: Object = {};

    static pub = (name: string, ...args: any[]) => {
        if (PubSub.registry[name]) {
            PubSub.lastFires[name] = args;
            PubSub.registry[name].forEach(function (fn: Function) { fn.apply(null, args) });
        }

        if (PubSub.registryOnce[name]) {
            PubSub.registryOnce[name].forEach(function (fn: Function) { fn.apply(null, args) });
            delete PubSub.registryOnce[name];
        }

        if (PubSub.registrySingleOnce[name]) {
            PubSub.registrySingleOnce[name].apply(null, args);
            delete PubSub.registrySingleOnce[name];
        }
    }

    /* 'retro=true' means that at the time we subscribe if an event of that type
    had already been published, then we refire it with the arguments it had last time it fired
    */
    static sub = (name: string, fn: Function, retro: boolean = true) => {
        if (retro && PubSub.lastFires[name]) {
            fn.apply(null, PubSub.lastFires[name]);
        }

        if (!PubSub.registry[name]) {
            PubSub.registry[name] = [fn];
        } else {
            PubSub.registry[name].push(fn);
        }
    }

    /* Subscribe a fire-and-forget event in a way that multiple things can subscribe */
    static subOnce = (name: string, fn: Function) => {
        if (!PubSub.registryOnce[name]) {
            PubSub.registryOnce[name] = [fn];
        } else {
            PubSub.registryOnce[name].push(fn);
        }
    }

    /* Subscribe a fire-and-forget event in a way that ONE function can subscribe (last subscription wins) */
    static subSingleOnce = (name: string, fn: Function) => {
        PubSub.registrySingleOnce[name] = fn;
    }
}
