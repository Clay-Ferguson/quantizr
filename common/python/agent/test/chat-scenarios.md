# Agent Tools - Test Scenarios

The following are chat messages and their expected [approximate] responses. We can use this information to run tests on `Quanta_Gradio_Agent_SG.py` for example. These scenarios make the assumption that we're using the the entire Quantizr Codebase (from github) as our root location for files, which we set in `/QuantaGradio/config.yaml` as the `source_folder` property. Wherever you see the AI answers below enclosed in parenthesis, it means that's not the actual AI output but a description of what that output should be.

----

## Testing LocateFile Tool

### Conversation

Human: What is the full path of file `agent_system_prompt.md` 

AI: The full path of the file agent_system_prompt.md is:
/common/python/agent/prompt_templates/agent_system_prompt.md

----

## Testing ReadFile Tool

### Conversation

Human: Explain to me what the `prompt_utils.py` file does.

AI: (The AI will have used LocateFile tool to get the full path to the file, and then use that full path to call ReadFile tool, to get the content of the file, and then use that file content to actually answer the question.)

----

## Testing WriteFile Tool

### Conversation

Human: Fix the typo near the top of the `temperature_convert.py` file.

AI: (The AI will have located the file, read the file, noticed the typo "Werld", which should be "World" and then called the WriteFile tool to update the file and fix the typo, and it will then explain to you what it just did.)

----

## Testing UpdateBlock Tool

### Conversation

Human: How many print statements are in code block `MyTestBlock`?

AI: (The AI will have used GetBlockInfo tool to read the block content, and then answer the question by showing the statements and then saying there's 3 of them.)

Human: Thanks, now add one more print statement in the block that prints "This line inserted by Agent"

AI: (The AI will have now used the UpdateBlock tool and added the new print statement as directed)

### Notes

This conversation has also proven that our correct context is being maintained in the chat history, and so when we said "the block" it knows which block we're talking about.

---

## Testing CreateFile Tool

### Conversation

Human: Create a text file in the root ('/') that contains the text "This awesome agent can create files!"

AI: (AI will have created the file as directed with the CreatFile tool, and knew to just invent a filename all by itself.)

---

## Testing DirectoryListing Tool

### Conversation

Human: What are the names of the files in the `/common` folder, recursively.

AI: (AI will have used the DirectoryListing tool and listed out all the file names.)

### Notes

It's probably obvious, but this tool is [likely] never useful just for humans to use to get names of files listed, but instead, what it does is empowers the AI to be able to get all the names of files in specific folders whenever it needs to do so to achieve some larger goal or objective.




