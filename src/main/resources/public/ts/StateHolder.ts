
/* Generic abstraction layer for state so that a type-safe state (this class) can be passed to other components, 
without those other components having to be made into generics themselves */
export class StateHolder<T> {
    state: T = {} as any;

    get(): T {
        return this.state;        
    }

    set(state: T) {
        this.state = state;
    }
}