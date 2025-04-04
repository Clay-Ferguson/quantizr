# Gradio-based AI Web Apps

NOTE: This `QuantaGradio` app is not required to run the Quanta CMS Web App. All Gradio code here is for several stand-alone Gradio apps (found in this folder), which do use all the same Python code that Quanta uses to run AI, however Quanta makes use of the Microservice in the `QuantaAI` folder in order to execute the AI Python code.

`Quanta_Gradio_Agent_SG.py` is the primary app in this project.

# Apps in this Project

* `Quanta_Gradio_Agent_SG.py` - This is the primary Gradio-based Quanta Coding Agent, which the `QuantaGradio Project` is dedicated to. The other files in the root of this project that are named like `Quanta_Gradio_*.py` are primarily for demonstrating how to use Gradio in "as simple as possible" use cases. However the "Image Generation App" and "Image Understanding App" are both fully functional Gradio apps that can do generation and understanding respecively, and are not necessarily examples/demos, because they just work, and are useful as is.

* `Quanta_Gradio_Agent.py` - Quanta Coding Agent. Most of the code for this app is in `common/python` folder of the Quantizr repository. The common code is used by several other projects.

* `Quanta_Gradio_ChatTest.py` - Chat app

* `Quanta_Gradio_ChatTest.py` - Same as `Quanta_Gradio_ChatTest.py` but with an actual StateGraph & Node Tree

* `Quanta_Gradio_AgentTest.py` - Chat app with tool-calling

* `Quanta_Gradio_ImageGen.py` - Image Generation app

* `Quanta_Gradio_ImageChat.py` - Image Understanding chat app. Lets you upload images, and ask questions about them.


# About Quanta Coding Agent (Quanta_Gradio_Agent.py)

The Quanta Coding Agent (QCA) features and capabilities are mostly the same regardless of whether you're running the the Quanta Web App, or the Quanta Gradio Agent (this project). Each way of using the QCA has it's own advantages and disadvantages. For example, the Quanta Web App itself is massive in size, complex, and complicated to configure and deploy, while this Quanta Gradio App is, like all Gradio apps, very easy to run, as long as you know how to run Python.


## How Quanta Coding Agent Works

A simple description of how this Gradio-based QCA works is as follows:

1) You first configure the config.yaml file to define which AI Cloude provider you will be using, your API KEY, etc. Also in the config.yaml you will define the root level folder name for where your project(s) are that the coding agent will work with. You can specifiy which subfolders to include or exclude, and which filename extensions to include.

2) Once your config.yaml is setup you can run the app with `run.sh` (after running `conda_init.sh` if you want to setup your env that way)

3) In the gradio app you can use the file(), folder(), and block() syntax (described in links below) to ask questions about your codebase or request actual direct real-time code refactoring to be done to your code base also.


## Documentation - Quanta Coding Agent Features

Here are a couple of links to the AI Docs on Github

* [Quanta Coding Agent Documentation on Github](https://github.com/Clay-Ferguson/quantizr/blob/main/docs/user-guide/index.md#ai-agent-for-code-refactoring)
* [All Quanta AI Documentation on Github](https://github.com/Clay-Ferguson/quantizr/blob/main/docs/user-guide/index.md)

## Testing (non-Automated)

The following file contains some test prompts you can submit to the coding agent (like `Quanta_Gradio_Agent_SG.py`) in a chat, to verify that each of the Agent Tools are working correctly: `/common/python/agent/test/chat-scenarios.md`
