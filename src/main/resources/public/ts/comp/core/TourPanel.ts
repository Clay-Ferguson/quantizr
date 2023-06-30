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
        children.push(new ButtonBar([
            tour.curStep > 0 ?
                new Button("Restart Tour", () => {
                    dispatch("PrevTourStep", s => {
                        s.tour.curStep = 0;
                    });
                }) : null,
            new Button(tour.curStep < tour.steps.length - 1 ? "Cancel Tour" : "I'm Finished", () => {
                dispatch("PrevTourStep", s => {
                    s.tour = null;
                });
            }),
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
                }, null /* { className: "tourHighlight" } */, "btn-primary") : null,
        ], "float-end"));
        children.push(new Span("Tour: " + tour.name, { className: "guidedTourHeading" }));
        children.push(new Span("Step " + (tour.curStep + 1) + "/" + tour.steps.length + ": " + //
            tour.steps[tour.curStep].name, { className: "guidedTourInstructions" }));

        this.setChildren(children);
        return true;
    }
}
