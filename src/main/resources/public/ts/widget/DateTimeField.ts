import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { DateField } from "./DateField";
import { Span } from "./Span";
import { TimeField } from "./TimeField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class DateTimeField extends Span {
    dateState: ValidatedState<any> = new ValidatedState<any>();
    timeState: ValidatedState<any> = new ValidatedState<any>();

    // dateTimeState holds the string value of the date number milliseconds
    constructor(private dateTimeState: ValidatedState<any>) {
        super(null);
        Object.assign(this.attribs, {
            className: "input-group"
        });

        let dateTimeStr: string = dateTimeState.getValue();
        let dateTime: Date;

        try {
            dateTime = new Date(parseInt(dateTimeStr));
            dateTime = S.util.addTimezoneOffset(dateTime, -1);
        }
        catch (e) {
            console.log("Unable to parse: " + dateTimeStr);
            dateTime = S.util.addTimezoneOffset(new Date(), -1);
        }

        let isoStr = dateTime.toISOString();
        // console.log("isoStr: " + isoStr);

        let dateStr = isoStr.substr(0, 10);
        this.dateState.setValue(dateStr);

        let hourStr: string = "" + dateTime.getUTCHours();
        if (hourStr.length < 2) {
            hourStr = "0" + hourStr;
        }

        let minStr: string = "" + dateTime.getUTCMinutes();
        if (minStr.length < 2) {
            minStr = "0" + minStr;
        }

        let timeStr = hourStr + ":" + minStr;
        this.timeState.setValue(timeStr);

        this.dateState.v.stateTranslator = (s: any): any => {
            try {
                let newTimestamp = s.value + " " + this.timeState.getValue() + ":00";
                let newDate = new Date(newTimestamp);
                this.dateTimeState.setValue("" + newDate.getTime());
            }
            catch (e) {
                console.log("ignoring date error");
            }
            return s;
        };

        this.timeState.v.stateTranslator = (s: any): any => {
            try {
                let newTimestamp = this.dateState.getValue() + " " + s.value + ":00";
                let newDate = new Date(newTimestamp);
                this.dateTimeState.setValue("" + newDate.getTime());
            }
            catch (e) {
                console.log("ignoring time error");
            }
            return s;
        };
    }

    preRender(): void {
        this.setChildren([
            new DateField(this.dateState),
            new TimeField(this.timeState)
        ]);
    }
}
