import { S } from "../../Singletons";
import { Validator } from "../../Validator";
import { Button } from "./Button";
import { DateField } from "./DateField";
import { IconButton } from "./IconButton";
import { Span } from "./Span";
import { TextField } from "./TextField";
import { TimeField } from "./TimeField";

export class DateTimeField extends Span {
    dateState: Validator = new Validator();
    timeState: Validator = new Validator();

    // dateTimeState holds the string value of the date number milliseconds
    constructor(private dateTimeState: Validator, private durationState: Validator,
        private showTime: boolean, private addTag: (val: string) => void) {
        super(null);
        this.attribs = {
            ...this.attribs, ...{
                className: "tw-flex marginRight"
            }
        };

        this.dateState.v.stateTranslator = (s: any): any => {
            try {
                const newDate = new Date(s.value + " " + this.timeState.getValue() + ":00");
                this.dateTimeState.setValue("" + newDate.getTime());
            }
            catch (e) {
                console.log("ignoring date error");
            }
            return s;
        };

        this.timeState.v.stateTranslator = (s: any): any => {
            try {
                const newDate = new Date(this.dateState.getValue() + " " + s.value + ":00");
                this.dateTimeState.setValue("" + newDate.getTime());
            }
            catch (e) {
                console.log("ignoring time error");
            }
            return s;
        };

        const dateTimeStr: string = dateTimeState.getValue();
        let dateTime: Date;

        try {
            if (!dateTimeStr) {
                dateTime = S.util.addTimezoneOffset(new Date(), -1);
            }
            else {
                dateTime = new Date(parseInt(dateTimeStr));
                dateTime = S.util.addTimezoneOffset(dateTime, -1);
            }
        }
        catch (e) {
            S.util.logErr(e, "Unable to parse: " + dateTimeStr);
            dateTime = S.util.addTimezoneOffset(new Date(), -1);
        }

        const isoStr = dateTime.toISOString();
        const dateStr = isoStr.substring(0, 10);
        this.dateState.setValue(dateStr);

        let hourStr: string = "" + dateTime.getUTCHours();
        if (hourStr.length < 2) {
            hourStr = "0" + hourStr;
        }

        let minStr: string = "" + dateTime.getUTCMinutes();
        if (minStr.length < 2) {
            minStr = "0" + minStr;
        }

        const timeStr = hourStr + ":" + minStr;
        this.timeState.setValue(timeStr);
    }

    override preRender(): boolean | null {
        this.children = [
            new DateField(this.dateState),
            this.showTime ? new TimeField(this.timeState, "marginLeft") : null,
            this.durationState ? new TextField({
                // NO LABEL!: We have no room at top for a label because we're lining up with the
                // rest of these components vertically which also have no labels. label: "HH:MM",
                placeholder: "Duration...",
                inputClass: "durationTypeInput",
                outterTagName: "span",
                val: this.durationState
            }) : null,
            new Span(null, { className: "bigMarginLeft" }, [
                new Button("+D", () => {
                    const date = new Date(this.dateState.getValue());
                    date.setDate(date.getDate() + 1);
                    const isoStr = date.toISOString();
                    const dateStr = isoStr.substring(0, 10);
                    this.dateState.setValue(dateStr);
                    S.util.flashMessage("Added one day", "Note", true);
                }, { title: "Add Day" }),
                new Button("+W", () => {
                    const date = new Date(this.dateState.getValue());
                    date.setDate(date.getDate() + 7);
                    const isoStr = date.toISOString();
                    const dateStr = isoStr.substring(0, 10);
                    this.dateState.setValue(dateStr);
                    S.util.flashMessage("Added one week", "Note", true);
                }, { title: "Add Week" }),
                new Button("+M", () => {
                    const date = new Date(this.dateState.getValue());
                    date.setMonth(date.getMonth() + 1);
                    const isoStr = date.toISOString();
                    const dateStr = isoStr.substring(0, 10);
                    this.dateState.setValue(dateStr);
                    S.util.flashMessage("Added one month", "Note", true);
                }, { title: "Add Month" }),
                new Button("+Y", () => {
                    const date = new Date(this.dateState.getValue());
                    date.setFullYear(date.getFullYear() + 1);
                    const isoStr = date.toISOString();
                    const dateStr = isoStr.substring(0, 10);
                    this.dateState.setValue(dateStr);
                    S.util.flashMessage("Added one year", "Note", true);
                }, { title: "Add Year" }),
                this.addTag ? new IconButton("fa-bell fa-lg", "", {
                    onClick: () => this.addTag("#due"),
                    title: "Make this a #due date"
                }) : null,
            ])
        ];
        return true;
    }
}
