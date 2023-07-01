import { dispatch, getAs } from "../../AppContext";
import { Button } from "./Button";
import { ButtonBar } from "./ButtonBar";
import { Div } from "./Div";
import { Span } from "./Span";

export class TourPanel extends Div {

    constructor() {
        super();
        this.attribs.className = "tourPanel";
        this.attribs.id = "tourPanelId";
    }

    override preRender(): boolean {
        const children = [];
        const ast = getAs();
        const tour = ast.tour;

        if (!tour) return false;

        children.push(new Span("Tour: " + tour.name, { className: "guidedTourHeading" }));

        let stepMsg = tour.steps[tour.curStep].name;
        if (tour.curStep < tour.steps.length - 1) {
            stepMsg += ", then `Next Step`";
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
                new Button("Previous Step", () => {
                    dispatch("PrevTourStep", s => {
                        s.tour.curStep--;
                    });
                }) : null,
            tour.curStep < tour.steps.length - 1 ?
                new Button("Next Step", () => {
                    dispatch("NextTourStep", s => {
                        s.tour.curStep++;
                    });
                }, null, "btn-primary") : null,
            tour.curStep >= tour.steps.length - 1 ? new Button("Finished!", () => {
                dispatch("PrevTourStep", s => {
                    s.tour = null;
                })
            }) : null
        ], "float-end"));


        if (ast.isAdminUser && tour.expectsLogin) {
            children.push(new Div("WARNING: This tour expects you to be logged in, for all steps to work.", { className: "alert alert-info" }));
        }

        this.setChildren(children);
        return true;
    }
}
