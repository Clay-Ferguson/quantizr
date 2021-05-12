import React, { useState } from "react";
import { Emojione } from "react-emoji-render";
import Picker from "emoji-picker-react";

// Example use:
// http://localhost:8182/demo/tsx-test

function TsxApp() {
    const [chosenEmoji, setChosenEmoji] = useState(null);

    const onEmojiClick = (event, emojiObject) => {
        setChosenEmoji(emojiObject);
    };

    return (
        <div>
            <h3>TsxApp Rendered Successfully!</h3>
            <Emojione text="This ❤️ sentence includes :+1: a variety of emoji types :)" />
            <p />
            <div>
                {chosenEmoji ? (
                    <span>You chose: {chosenEmoji.emoji}</span>
                ) : (
                    <span>No emoji Chosen</span>
                )}
                <Picker onEmojiClick={onEmojiClick} />
            </div>
        </div>
    );
}

export default TsxApp;
