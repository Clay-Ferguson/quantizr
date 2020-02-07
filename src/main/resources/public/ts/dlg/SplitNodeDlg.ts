import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { RadioButton } from "../widget/RadioButton";
import { RadioButtonGroup } from "../widget/RadioButtonGroup";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { TextField } from "../widget/TextField";
import { TextContent } from "../widget/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SplitNodeDlg extends DialogBase {

    inlineRadioButton: RadioButton;
    childrenRadioButton: RadioButton;

    doubleSpacedRadioButton: RadioButton;
    tripleSpacedRadioButton: RadioButton;
    customDelimRadioButton: RadioButton;
    delimiterTextField: TextField;

    constructor() {
        super("Split Node");

        this.setChildren([
            new TextContent("Split into multiple nodes..."),

            new RadioButtonGroup([
                this.childrenRadioButton = new RadioButton("Split into Children", true, "splitTypeGroup"),
                this.inlineRadioButton = new RadioButton("Split Inline", false, "splitTypeGroup"),
            ], "form-group-border margin-bottom"),

            new RadioButtonGroup([
                this.doubleSpacedRadioButton = new RadioButton("Double Spaced", true, "splitSpacingGroup",
                    {
                        onChange: (evt: any) => {
                            if (evt.target.checked) {
                                this.delimiterTextField.setVisible(false);
                            }
                        }
                    }),
                this.tripleSpacedRadioButton = new RadioButton("Triple Spaced", false, "splitSpacingGroup",
                    {
                        onChange: (evt: any) => {
                            if (evt.target.checked) {
                                this.delimiterTextField.setVisible(false);
                            }
                        }
                    }),
                this.customDelimRadioButton = new RadioButton("Custom Delimiter", false, "splitSpacingGroup",
                    {
                        onChange: (evt: any) => {
                            if (evt.target.checked) {
                                this.delimiterTextField.setVisible(true);
                            }
                        }
                    }),
            ], "form-group-border margin-bottom"),

            this.delimiterTextField = new TextField("Delimiter"),
            new ButtonBar([
                new Button("Ok", this.splitNodes, null, "primary"),
                new Button("Close", () => {
                    this.close();
                })
            ])
        ]);

        this.delimiterTextField.setVisible(false);
    }

    splitNodes = (): void => {
        let highlightNode = S.meta64.getHighlightedNode();
        if (highlightNode) {
            let splitType = this.childrenRadioButton.getChecked() ? "children" : "inline";

            let delim = "";
            if (this.doubleSpacedRadioButton.getChecked()) {
                delim = "\n\n\n";
            }
            else if (this.tripleSpacedRadioButton.getChecked()) {
                delim = "\n\n\n\n";
            }
            else if (this.customDelimRadioButton.getChecked()) {
                delim = this.delimiterTextField.getValue();
            }

            S.edit.splitNode(splitType, delim)
        }
        this.close();
    }
}
