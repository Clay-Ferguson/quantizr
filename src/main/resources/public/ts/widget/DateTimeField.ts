import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { ValueIntf } from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { DateField } from "./DateField";
import { Span } from "./Span";
import { TimeField } from "./TimeField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class DateTimeField extends Span {

    dateValueIntf: ValueIntf;
    timeValueIntf: ValueIntf;

    constructor(private valueIntf: ValueIntf) {
        super(null);
        S.util.mergeProps(this.attribs, {
            className: "input-group"
        });

        let dateTimeStr: string = valueIntf.getValue();
        let dateTime: Date;

        if (!dateTimeStr) {
            dateTime = new Date();
            dateTime = S.util.addTimezoneOffset(dateTime, -1);
        }
        else {
            try {
                dateTime = new Date(parseInt(dateTimeStr));
                dateTime = S.util.addTimezoneOffset(dateTime, -1);
                //console.log("parsed ok: " + dateTimeStr + " proof=" + dateTime.toLocaleDateString());
            }
            catch (e) {
                console.log("Unable to parse: " + dateTimeStr);
                dateTime = S.util.addTimezoneOffset(new Date(), -1);
            }
        }

        let isoStr = dateTime.toISOString();
        //console.log("isoStr: " + isoStr);

        let dateStr = isoStr.substr(0, 10);
        this.mergeState({ date: dateStr });

        let hourStr: string = "" + dateTime.getUTCHours();
        if (hourStr.length < 2) {
            hourStr = "0" + hourStr;
        }

        let minStr: string = "" + dateTime.getUTCMinutes();
        if (minStr.length < 2) {
            minStr = "0" + minStr;
        }

        let timeStr = hourStr + ":" + minStr;

        //console.log("timeStr: " + timeStr);
        this.mergeState({ time: timeStr });

        this.dateValueIntf = {
            setValue: (val: string): void => {
                try {
                    let newTimestamp = val + " " + this.timeValueIntf.getValue() + ":00";
                    let newDate = new Date(newTimestamp);

                    if (newDate && newDate.getTime()) {
                        this.valueIntf.setValue("" + newDate.getTime());
                        this.mergeState({ date: val });
                    }
                }
                catch (e) {
                    console.log("ignoring date error");
                }
            },

            getValue: (): string => {
                //console.log("Getting Date: " + this.getState().date);
                return this.getState().date;
            }
        };

        this.timeValueIntf = {
            setValue: (val: string): void => {
                try {
                    let newTimestamp = this.dateValueIntf.getValue() + " " + val + ":00";
                    //console.log("newTimestamp(b): " + newTimestamp);
                    let newDate = new Date(newTimestamp);

                    if (newDate && newDate.getTime()) {
                        this.valueIntf.setValue("" + newDate.getTime());
                        this.mergeState({ time: val });
                    }
                }
                catch (e) {
                }
            },

            getValue: (): string => {
                //console.log("Getting Time: " + this.getState().time);
                return this.getState().time;
            }
        };
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        let dateField = new DateField(this.dateValueIntf);
        let timeField = new TimeField(this.timeValueIntf);

        this.setChildren([dateField, timeField]);
    }
}
