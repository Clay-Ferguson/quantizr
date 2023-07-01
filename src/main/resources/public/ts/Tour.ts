import { TourStep } from "./TourStep";

export class Tour {
    curStep = 0;

    constructor(public name: string, public steps: TourStep[], public expectsLogin = true) {
    }
}

