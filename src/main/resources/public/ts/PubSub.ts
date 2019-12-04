/* Basic Pub/Sub Implementation */

export class PubSub {

    private static registry: Object = {};
    private static lastFires: Object = {};
    
    static pub = (name: string, ...args: any[]) => {
        if (!PubSub.registry[name]) {
            throw "Unknown publish name: " + name;
        }
        PubSub.lastFires[name] = args;
        PubSub.registry[name].forEach(fn => {
            fn.apply(null, args);
        });
    }

    /* 'retro=true' means that at the time we subscribe if an event of that type
    had already been published, then we refire it with the arguments it had last time it fired
    */
    static sub = (name: string, fn: Function, retro : boolean=true) => {
        if (retro && PubSub.lastFires[name]) {
            fn.apply(null, PubSub.lastFires[name]);
        }

        if (!PubSub.registry[name]) {
            PubSub.registry[name] = [fn];
        } else {
            PubSub.registry[name].push(fn);
        }
    }
}