import { dispatch, getAs } from "./AppContext";
import { Tour } from "./Tour";
import { TourStep } from "./TourStep";

export class TourUtils {
    tours: Tour[] = null;

    init = () => {
        if (this.tours) return;
        this.tours = [
            new Tour("Create a New Node", [
                new TourStep("Click `My Account` to go to your Account Root", ".ui-my-account"),
                new TourStep("Click the Plus Button to create a new under your account root", ".ui-new-node-plus-top"),
                new TourStep("Type some content and click Save", ".ui-editor-save"),
                new TourStep("If you want to Edit the Node again, click the Edit Button", ".ui-edit-node")
            ]),
            new Tour("Make a Node Public", [
                new TourStep("Click `My Account` to go to your Account Root", ".ui-my-account"),
                new TourStep("Click edit button on the node you want to share", ".ui-edit-node"),
                new TourStep("Click the Sharing button", ".ui-editor-share"),
                new TourStep("Click the Make Public button", ".ui-share-make-public"),
                new TourStep("Click Done to exit the Sharing Dialog", ".ui-sharing-done"),
                new TourStep("Click Save to exit the Node Editor", ".ui-editor-save"),
            ])
        ];
    }

    afterDispatch = () => {
        setTimeout(() => {
            let ast = getAs();
            if (!ast) return;

            if (ast.tour) {
                // const allElms = document.getElementsByClassName("ui-signup");
                let elms = document.querySelectorAll(ast.tour.steps[ast.tour.curStep].classHighlights);
                if (elms.length == 0) {
                    console.warn("Didn't find elements for tour: " + ast.tour.steps[ast.tour.curStep].classHighlights);
                }
                else {
                    for (let i = 0; i < elms.length; i++) {
                        elms[i].classList.add("tourHighlight");

                        // For now let's advance to next step automatically, although this may not necessarily
                        // always work.
                        elms[i].addEventListener("click", () => {
                            setTimeout(() => {
                                dispatch("AdvanceTourStep", s => {
                                    if (s.tour && s.tour.curStep < s.tour.steps.length - 1) {
                                        s.tour.curStep++;
                                    }
                                });
                            }, 1000);
                        });
                    }
                }
            }
        }, 500);
    }
}