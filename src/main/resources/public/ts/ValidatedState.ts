import { State } from "./State";

/* todo-2: Finish making this type safe, and don't use 'any' inside here */
export class ValidatedState<S> {
    v: State = new State();
    e: State = new State();

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

    setError = (error: string) => {
        this.e.mergeState({ error });
    }
}
