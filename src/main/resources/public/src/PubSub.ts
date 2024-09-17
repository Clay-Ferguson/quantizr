/* Basic Pub/Sub Implementation */

export class PubSub {

    // functions that will keep firing every time the pub event is published
    // (each element holds an array of functions)
    private static registry: any = {};

    // functions that are a fire-and-forget that fire once and never again
    // (each element holds an array of functions)
    private static registryOnce: any = {};

    // allows only ONE function at a time to subscribe to any given event. Last sub overrides any
    // previous or pending ones (each element holds a function, not an array)
    private static registrySingleOnce: any = {};

    private static lastFires: any = {};

    static pub(name: string, ...args: any[]) {
        if (PubSub.registry[name]) {
            PubSub.lastFires[name] = args;
            PubSub.registry[name].forEach((fn: (...args: any[]) => void) => fn(...args));
        }

        if (PubSub.registryOnce[name]) {
            PubSub.registryOnce[name].forEach((fn: (...args: any[]) => void) => fn(...args));
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
    static sub(name: string, fn: (payload: any) => void, retro: boolean = true) {
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
    static subOnce(name: string, fn: (payload: any) => void) {
        if (!PubSub.registryOnce[name]) {
            PubSub.registryOnce[name] = [fn];
        } else {
            PubSub.registryOnce[name].push(fn);
        }
    }

    /* Subscribe a fire-and-forget event in a way that ONE function can subscribe (last subscription wins) */
    static subSingleOnce(name: string, fn: (payload: any) => void) {
        PubSub.registrySingleOnce[name] = fn;
    }
}
