import React from "react";
import { Emojione } from "react-emoji-render";

// Example use:
// http://localhost:8182/demo/tsx-test

function TsxApp() {
    return (
        <div>
            <h3>TsxApp Rendered Successfully!</h3>
            <Emojione text="This ❤️ sentence includes :+1: a variety of emoji types :)" />
        </div>
    );
}

export default TsxApp;
