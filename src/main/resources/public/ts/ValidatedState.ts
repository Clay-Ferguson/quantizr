import { State } from "./State";

/* todo-1: Finish making this type safe, and don't use 'any' inside here */
export class ValidatedState<S> {
    v: State<S> = new State<S>();
    e: State<S> = new State<S>();

    constructor(val: any = null) {
        this.setValue(val);
    }

    getValue(): any {
        return this.v.state.value || "";
    }

    setValue(value: any): any {
        this.v.mergeState({ value: value || "" });
    }

    getError(): string {
        return this.e.state.error;
    }

    setError = (error: string): void => {
        this.e.mergeState({ error });
    }
}
