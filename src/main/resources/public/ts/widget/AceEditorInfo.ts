import { AceEditPropTextarea } from "./AceEditPropTextarea";

/**
 * Pure data structure that allows us to associate what editors are editing what properties so that when the save button is clicked on the save dialog we can persist the info 
 * from the editor control into the property .
 */
export class AceEditorInfo {

    constructor(public editor: AceEditPropTextarea) {
    }
}

