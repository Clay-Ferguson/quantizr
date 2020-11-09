import { State } from "./State";

export class ValidatedState<S> {
    v: State<S> = new State<S>();
    e: State<S> = new State<S>();

    getValue(): any {
        return this.v.state.value;
    }

    setValue(value: any): any {
        this.v.mergeState({ value });
    }

    getError(): string {
        return this.e.state.error;
    }

    setError = (error: string): void => {
        this.e.mergeState({ error });
    }
}
