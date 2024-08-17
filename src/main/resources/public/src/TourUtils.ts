import { getAs } from "./AppContext";
import { Tour } from "./Tour";
import { TourStep } from "./TourStep";

export class TourUtils {
    tours: Tour[] = null;

    init = () => {
        if (this.tours) return;
        this.tours = [
            new Tour("Create a New Node", [
                new TourStep("Click `My Account` to go to your Account Root.", ".ui-my-account"),
                new TourStep("Open `Options` Menu, and be sure `Edit Mode` is selected.", ".ui-menu-options"),
                new TourStep("Click a `Plus Button` to create a new Node under your account root.", ".ui-new-node-plus"),
                new TourStep("Type some content and click `Save`.", ".ui-editor-save"),
                new TourStep("If you want to Edit the Node again, click the `Edit` Button.", ".ui-edit-node")
            ]),
            new Tour("Make a Node Public", [
                new TourStep("Click `My Account` to go to your Account Root.", ".ui-my-account"),
                new TourStep("Open `Options` Menu, and be sure `Edit Mode` is selected.", ".ui-menu-options"),
                new TourStep("Click edit button on the node you want to share.", ".ui-edit-node"),
                new TourStep("Click the `Sharing` button.", ".ui-editor-share"),
                new TourStep("Click the `Make Public` button.", ".ui-share-make-public"),
                new TourStep("Click Done to exit the `Sharing Dialog`.", ".ui-sharing-done"),
                new TourStep("Click Save to exit the Node Editor.", ".ui-editor-save"),
            ]),
            new Tour("Subscribe to an RSS Feed", [
                new TourStep("Click `My Account` to go to your Account Root.", ".ui-my-account"),
                new TourStep("Open `Options` Menu, and be sure `Edit Mode` is selected.", ".ui-menu-options"),
                new TourStep("Click on your Top-of-Page Node to make sure it's `selected`.", ".ui-tree-node-top"),
                new TourStep("Open the Create menu and choose 'RSS Feed`, to insert underneath the `selected` node.", ".ui-menu-create"),
                new TourStep("Enter an RSS Feed Description in the top text area. Enter RSS URLs in lower text area, and click `Save`.", ".ui-editor-save"),
                new TourStep("Click the `View Feed` button to load and display the Feed Content.", ".ui-rss-view-feed-btn"),
                new TourStep("You should now be on the `RSS Feed` tab, but you can click `Folders` to go back where you came from.", ".ui-app-tab-btn"),
            ]),
        ];
    }

    afterDispatch = () => {
        setTimeout(() => {
            const ast = getAs();
            if (!ast) return;

            if (ast.tour) {
                const elms = document.querySelectorAll(ast.tour.steps[ast.tour.curStep].classHighlights);
                if (elms.length == 0) {
                    console.warn("Didn't find elements for tour: " + ast.tour.steps[ast.tour.curStep].classHighlights);
                }
                else {
                    for (let i = 0; i < elms.length; i++) {
                        console.log("Class Found: " + elms[i].id);
                        elms[i].classList.add("tourHighlight");

                        // TODO: This will be more challenging, because we might need to allow the
                        // user to make multiple clicks to reach that desired 'state' to move
                        // forward, so let's require a manual click of the "Next Step" button for
                        // now.
                        //
                        // // Advancees to next step automatically, although this may not necessarily
                        // // always work.
                        // elms[i].addEventListener("click", () => {
                        //     setTimeout(() => {
                        //         dispatch("AdvanceTourStep", s => {
                        //             if (s.tour && s.tour.curStep < s.tour.steps.length - 1) {
                        //                 s.tour.curStep++;
                        //             }
                        //         });
                        //     }, 1000);
                        // });
                    }
                }
            }
        }, 500);
    }
}