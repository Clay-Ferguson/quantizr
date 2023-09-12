import { State } from "./State";
import { S } from "./Singletons";

/* todo-2: Finish making this type safe, and don't use 'any' inside here */
export class Validator {
    v: State = new State();
    e: State = new State();

    constructor(val: any = null, public rules: ValidatorRule[] = null) {
        this.setValue(val);
        rules?.forEach(rule => this.ensureDefaultMessage(rule));
    }

    /* Returns true if value is valid */
    validate = (): boolean => {
        if (!this.rules) return true;
        let errors: string[] = null;
        let ret = true;
        for (const rule of this.rules) {
            if (!this.checkRule(rule)) {
                errors = errors || [];
                errors.push(rule.errorMsg);
                ret = false;
            }
        }
        if (!ret) {
            this.setError(errors.join(", "));
        }
        else {
            this.setError(null);
        }
        return ret;
    }

    ensureDefaultMessage = (rule: ValidatorRule): void => {
        switch (rule.name) {
            case ValidatorRuleName.REQUIRED:
                rule.errorMsg = rule.errorMsg || "Cannot be left blank";
                break;
            case ValidatorRuleName.MAXLEN:
                rule.errorMsg = rule.errorMsg || ("Maximum length is " + rule.payload);
                break;
            case ValidatorRuleName.MINLEN:
                rule.errorMsg = rule.errorMsg || ("Minimum length is " + rule.payload);
                break;
            case ValidatorRuleName.USERNAME:
                rule.errorMsg = rule.errorMsg || "Only letters numbers dashes and underscores";
                break;
            default:
                break;
        }
    }

    /* returns true if valid */
    checkRule = (rule: ValidatorRule): boolean => {
        switch (rule.name) {
            case ValidatorRuleName.REQUIRED:
                if (!this.v.state.value) {
                    return false;
                }
                break;
            case ValidatorRuleName.MAXLEN:
                if (this.v.state.value?.length > rule.payload) {
                    return false;
                }
                break;
            case ValidatorRuleName.MINLEN:
                if (this.v.state.value?.length < rule.payload) {
                    return false;
                }
                break;
            case ValidatorRuleName.USERNAME:
                if (!S.util.validUsername(this.v.state.value)) {
                    return false;
                }
                break;
            default:
                break;
        }
        return true;
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

export enum ValidatorRuleName {
    // eslint-disable-next-line no-unused-vars
    REQUIRED, MAXLEN, MINLEN, USERNAME
}

export interface ValidatorRule {
    name?: ValidatorRuleName;
    payload?: any;
    errorMsg?: string;
}
