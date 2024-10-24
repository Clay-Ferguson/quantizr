import { dispatch, getAs } from "../../AppContext";
import { Comp } from "../base/Comp";
import { Button } from "./Button";
import { ButtonBar } from "./ButtonBar";
import { Div } from "./Div";
import { Span } from "./Span";

export class TourPanel extends Comp {

    constructor() {
        super();
        this.attribs.className = "tourPanel";
        this.attribs.id = "tourPanelId";
    }

    override preRender(): boolean | null {
        const children = [];
        const ast = getAs();
        const tour = ast.tour;

        if (!tour) return false;

        children.push(new Span("Tour: " + tour.name, { className: "guidedTourHeading" }));

        let stepMsg = tour.steps[tour.curStep].name;
        if (tour.curStep < tour.steps.length - 1) {
            stepMsg += " Then click `Next Step`";
        }
        children.push(new Span("Step " + (tour.curStep + 1) + "/" + tour.steps.length + ": " + //
            stepMsg, { className: "guidedTourInstructions" }));

        children.push(new ButtonBar([
            tour.curStep > 0 ?
                new Button("Restart", () => {
                    dispatch("PrevTourStep", s => {
                        s.tour.curStep = 0;
                    });
                }) : null,
            tour.curStep < tour.steps.length - 1 ? new Button("Cancel", () => {
                dispatch("PrevTourStep", s => {
                    s.tour = null;
                });
            }) : null,
            tour.curStep > 0 ?
                new Button("Go Back", () => {
                    dispatch("PrevTourStep", s => {
                        s.tour.curStep--;
                    });
                }) : null,
            tour.curStep < tour.steps.length - 1 ?
                new Button("Next Step", () => {
                    dispatch("NextTourStep", s => {
                        s.tour.curStep++;
                    });
                }, null, "-primary") : null,
            tour.curStep >= tour.steps.length - 1 ? new Button("Finished!", () => {
                dispatch("PrevTourStep", s => {
                    s.tour = null;
                })
            }, null, "-primary") : null
        ], "tw-float-right"));


        if (ast.isAnonUser && tour.expectsLogin) {
            children.push(new Div("*** NOTE: This tour requires you to be logged in, for the steps to work.", { className: "bigMarginLeft marginTop" }));
        }

        this.children = children;
        return true;
    }
}
