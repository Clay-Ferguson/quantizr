/* 
MINI REACT!

This is a miniature version of ReactJS. This application (QuantaChat) is being used as an experimental 
testbed to prove that a radically simpler version of React, which is what this file is, can be used to do 
everything that most apps really need React to be doing, so rather than the large framework, we can just 
use this file instead */

class MiniReact {
    renderMap = new Map(); // To keep track of rendered components, by Id

    constructor() {
        console.log('MiniReact singleton created');
    }

    static getInst() {
        // Create instance if it doesn't exist
        if (!MiniReact.inst) {
            MiniReact.inst = new MiniReact();
        }
        return MiniReact.inst;
    }

    addSection(id, renderFunction) {
        this.renderMap.set(id, { renderFunction });
    }

    refreshAll() {
        // we'll run this kind of thing for everything in the renderMap: this.rootVirtualNode = mr.refresh(dom.byId('root'), this.rootVirtualNode, this.render());
        this.renderMap.forEach((item, id) => {
            console.log(`Refreshing section with id: ${id} hasVirtualNode: ${item.virtualNode !== undefined}`);
            const newVirtualNode = item.renderFunction();
            item.virtualNode = this.refresh(document.getElementById(id), item.virtualNode, newVirtualNode);
        });
    }

    // Diffing and Patching Function
    refresh(parentDOM, oldVirtualNode, newVirtualNode) {
        // console.log("refresh called with:", { parentDOM, oldVirtualNode, newVirtualNode });

        if (!oldVirtualNode) {
            // console.log("Adding new node");
            const newDOM = this.createDOMElement(newVirtualNode);
            parentDOM.appendChild(newDOM);
            newVirtualNode.dom = newDOM;
            return newVirtualNode;
        }

        if (!newVirtualNode && oldVirtualNode) {
            // console.log("Removing old node");
            parentDOM.removeChild(oldVirtualNode.dom);
            return null;
        }

        if (oldVirtualNode && newVirtualNode && oldVirtualNode.type !== newVirtualNode.type) {
            // console.log("Replacing node");
            const newDOM = this.createDOMElement(newVirtualNode);
            parentDOM.replaceChild(newDOM, oldVirtualNode.dom);
            newVirtualNode.dom = newDOM;
            return newVirtualNode;
        }

        // IMPORTANT: Ensure newVirtualNode.dom is set here!
        newVirtualNode.dom = oldVirtualNode.dom; // Keep the DOM reference

        // console.log("Updating props");
        this.updateProps(newVirtualNode.dom, oldVirtualNode.props, newVirtualNode.props);

        // console.log("Diffing children");
        const newChildren = [];
        const oldChildren = oldVirtualNode.children || [];
        const newChildrenNodes = newVirtualNode.children || [];
        const maxLength = Math.max(oldChildren.length, newChildrenNodes.length);

        for (let i = 0; i < maxLength; i++) {
            const childVirtualNode = this.refresh(oldVirtualNode.dom, oldChildren[i], newChildrenNodes[i]);
            if (childVirtualNode) {
                newChildren.push(childVirtualNode);
            }
        }

        newVirtualNode.children = newChildren;
        return newVirtualNode;
    }

    createDOMElement(virtualNode) {
        // console.log("createDOMElement called with:", virtualNode);
        const element = document.createElement(virtualNode.type);
        this.updateProps(element, {}, virtualNode.props);
        if (virtualNode.children) {
            const children = virtualNode.children;
            if (!children) {
                throw new Error("createDOMElement: virtualNode.children is null or undefined");
            }
            children.forEach(child => {
                if (child) {
                    const childElement = this.createDOMElement(child);
                    element.appendChild(childElement);
                }
            });
        }
        virtualNode.dom = element; //  Set the dom property here!
        return element;
    }

    updateProps(dom, oldProps, newProps) {
        // console.log("updateProps called with:", { dom, oldProps, newProps });
        if (!dom) {
            throw new Error("updateProps: dom is null or undefined");
        }
        const allProps = { ...oldProps, ...newProps };
        const propsKeys = Object.keys(allProps);
        if (!propsKeys) {
            throw new Error("updateProps: Object.keys(allProps) is null or undefined");
        }
        propsKeys.forEach(key => {
            if (key === "text") {
                dom.textContent = newProps[key] || '';
            } else if (key === "onClick") {
                if (oldProps[key]) {
                    dom.removeEventListener('click', oldProps[key]);
                }
                dom.addEventListener('click', newProps[key]);
            } else if (key === "onChange") {
                if (oldProps[key]) {
                    dom.removeEventListener('change', oldProps[key]);
                }
                dom.addEventListener('change', newProps[key]);
            }
            else {
                // handle other attributes
                if (newProps[key]) {
                    dom.setAttribute(key, newProps[key]);
                } else {
                    dom.removeAttribute(key);
                }
            }
        });
    }
}

export default MiniReact;
