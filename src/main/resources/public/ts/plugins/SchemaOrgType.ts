import { TypeBase } from "./base/TypeBase";

export class SchemaOrgType extends TypeBase {
    constructor(typeName: string, displayName: string) {
        super(typeName, displayName, "fa-align-left", true);
    }
}
