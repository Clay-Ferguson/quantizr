# About Quanta Gradio

This is a Web-based GUI tool based on Gradio and Langchain, which runs our Quanta Agent code as a web app. Most of the code for this app is in `common/python` folder of the Quantizr repository, because the common code is used by several other projects.


# About Quanta Coding Agent

The Quanta Coding Agent (QCA) features and capabilities are mostly the same regardless of whether you're running the the Quanta Web App (i.e. what's running at https://quanta.wiki), or the Quanta Gradio Agent (this project). Each way of using the QCA has it's own advantages and disadvantages. For example, the Quanta Web App itself is massive in size, complex, and complicated to configure and deploy, while this Quanta Gradio App is, like all Gradio apps, very easy to run, as long as you know how to run Python.


# How Coding Agent Works

A simple description of how this Gradio-based QCA works is as follows:

1) You first configure the config.yaml file to define which AI Cloude provider you will be using, your API KEY, etc. Also in the config.yaml you will define the root level folder name for where your project(s) are that the coding agent will work with. You can specifiy which subfolders to include or exclude, and which filename extensions to include.

2) Once your config.yaml is setup you can run the app with `run.sh` (after running `conda_init.sh` if you want to setup your env that way)

3) In the gradio app you can use the file(), folder(), and block() syntax (described in links below) to ask questions about your codebase or request actual direct real-time code refactoring to be done to your code base also.


# Documentation - Coding Agent Features

Here are a couple of links to the AI Docs on Github

* [Quanta Coding Agent Documentation on Github](https://github.com/Clay-Ferguson/quantizr/blob/main/docs/user-guide/index.md#ai-agent-for-code-refactoring)
* [All Quanta AI Documentation on Github](https://github.com/Clay-Ferguson/quantizr/blob/main/docs/user-guide/index.md)


# Minimalist Gradio Apps

The primary reason for this project is to have `Quanta_Gradio_Agent.py`, which is the Coding Agent Gradio App, however there are several other minimalist sample Gradio apps in the root folder which are as follows:

* `Quanta_Gradio_ChatTest.py` - The minimalist example of a working Gradio chatbot

* `Quanta_Gradio_AgentTest.py` - The minimalist example of a working Gradio chatbot with Tool-calling capability

* `Quanta_Gradio_Image.py` - The minimalist example of a working Gradio Image Generation App

These minimalist projects are included only to help other developers who are getting started with Gradio AI Chatbots, or Image Generation

