class DOM {
    constructor() {
        console.log('DOM singleton created');
    }

    static getInst() {
        // Create instance if it doesn't exist
        if (!DOM.inst) {
            DOM.inst = new DOM();
        }

        return DOM.inst;
    }

    a(text, classes) {
        return this.makeElement('a', text, classes);
    }

    div(text, classes) {
        return this.makeElement('div', text, classes);
    }

    span(text, classes) {
        return this.makeElement('span', text, classes);
    }

    img(text, classes) {
        return this.makeElement('img', text, classes);
    }

    button(text, classes) {
        return this.makeElement('button', text, classes);
    }

    makeElement(tagName, text, classes) {
        const element = document.createElement(tagName);
        return this.config(element, text, classes);
    }

    config(element, textContent, classNames) {
        if (textContent) {
            element.textContent = textContent;
        }
        if (classNames) {
            if (typeof classNames === 'string') {
                // Split the string by spaces and add each class
                classNames.split(/\s+/).forEach(className => {
                    if (className) element.classList.add(className);
                });
            } else if (Array.isArray(classNames)) {
                classNames.forEach(className => element.classList.add(className));
            }
        }
        return element;
    }

    // was 'elm'
    byId(id) {
        return document.getElementById(id);
    }
}

export default DOM;
