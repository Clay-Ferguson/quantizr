import { dispatch, getAs } from "../AppContext";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { SchemaOrgPropsTable } from "../comp/SchemaOrgPropsTable";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";

export class EditPropertyDlg extends DialogBase {

    nameState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor(private editNode: J.NodeInfo) {
        super("Add Property", "app-modal-content-narrow-width");
        this.validatedStates = [this.nameState];
        const type = S.plugin.getType(this.editNode.type);
        if (type) {
            this.title = "Add Property: " + type.getName();
        }
    }

    renderDlg(): CompIntf[] {
        const type = S.plugin.getType(this.editNode.type);
        const showSchemaOrg = getAs().showSchemaOrgProps;

        return [
            new Div(null, { className: "marginBottom" }, [
                new TextField({ label: "Name", val: this.nameState })
            ]),

            type?.schemaOrg?.props ? new Checkbox("Schema.org Props", { className: "marginRight" }, {
                setValue: (checked: boolean) => dispatch("SetSchemaOrgProps", s => { s.showSchemaOrgProps = checked; }),
                getValue: (): boolean => getAs().showSchemaOrgProps
            }) : null,

            showSchemaOrg && type?.schemaOrg?.props ? new SchemaOrgPropsTable(type.schemaOrg.props) : null,

            new ButtonBar([
                new Button("Save", this.save, null, "btn-primary"),
                new Button("Cancel", this.close)
            ], "marginTop")
        ];
    }

    save = () => {
        if (!this.validate()) {
            return;
        }
        const name = this.nameState.getValue();

        /* verify first that this property doesn't already exist */
        if (S.props.getProp(name, this.editNode)) {
            S.util.showMessage("Property already exists: " + name, "Warning");
            return;
        }
        this.close();
    }
}
