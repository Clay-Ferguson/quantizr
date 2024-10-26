import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { Validator, ValidatorRuleName } from "../Validator";
import { NodeLink } from "../JavaIntf";
import { Checkbox } from "../comp/core/Checkbox";
import { getAs } from "../AppContext";
import { S } from "../Singletons";

export class AskNodeLinkNameDlg extends DialogBase {
    editExisting: boolean = false;
    static nameState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor(public link: NodeLink) {
        super("RDF Link", "appModalContNarrowWidth");
        this.editExisting = !!link;
        this.link = link || {} as NodeLink;
        AskNodeLinkNameDlg.nameState.setValue(this.link.name || "");

        if (AskNodeLinkNameDlg.nameState.getValue() === "") {
            AskNodeLinkNameDlg.nameState.setValue("link");
        }
        this.validatedStates = [AskNodeLinkNameDlg.nameState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextField({ label: "Predicate", val: AskNodeLinkNameDlg.nameState }),
                new Checkbox("Embed Content", { className: "mt-3" }, {
                    setValue: (checked: boolean) => this.link.embed = checked,
                    getValue: (): boolean => this.link.embed
                })
            ]),
            new ButtonBar([
                new Button("Save", this.save, null, "-primary"),
                this.editExisting ? new Button("Delete", this.delete, null, "-danger") : null,
                new Button("Cancel", () => {
                    this.link = null;
                    this.close()
                })
            ], "mt-3")
        ];
    }

    delete = (): void => {
        const ast = getAs();
        const name = AskNodeLinkNameDlg.nameState.getValue();
        ast.editNode.links = ast.editNode.links.filter(link => link.name !== name);
        this.close();
        S.edit.updateNode(ast.editNode);
    }

    save = () => {
        if (!this.validate()) {
            return;
        }
        this.link.name = AskNodeLinkNameDlg.nameState.getValue();

        if (this.editExisting) {
            S.edit.updateNode(getAs().editNode);
        }
        this.close();
    }
}
