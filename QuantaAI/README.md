# About QuantaAI

 This is the Quanta AI microservice, which will run inside the Quanta Docker stack to provide all AI services to the Quanta web app. We have this class specifically because it's far better to use Python for all AI functionality, than to use Java-based AI code. A scondary reason is simply because we can eventually gain access to the entire world of capabilities available in Python, like generating charts and graphs, etc. because Python has a better ecosystem of these types of features than Java does.

# Tips
 
## Adding Packages 

   cd QuantaAI
   conda create -n quanta_ai python=3.12.3
   conda activate quanta_ai
   pip install <package>
   pip freeze > requirements.txt

## Package Out of Date?

   pip list --outdated
   pip install -U <package>
   pip freeze > requirements.txt

# Conda Environment Tips

## To Reset Packages

To reset your conda environment with just the packages specified in your 'requirements.txt' file, you can follow these steps:

1. First, deactivate your current environment:
   ```
   conda deactivate
   ```

2. Remove the existing environment completely. 
   ```
   conda remove --name quanta_ai --all
   ```

3. Create a new environment with the same name (or a new name if you prefer):
   ```
   conda create --name quanta_ai python=3.12.3
   ```
   Replace '3.x' with your desired Python version (e.g., 3.8, 3.9, etc.)

4. Activate the new environment:
   ```
   conda activate quanta_ai
   ```

5. Install the packages from your requirements.txt file:
   ```
   pip install -r requirements.txt
   ```

   Note: If some packages in your requirements.txt are conda-specific or you prefer to use conda for installation, you can use:
   ```
   conda install --file requirements.txt
   ```
   However, this might not work for all packages, especially if they're only available on PyPI.

6. Verify your environment:
   ```
   conda list
   ```
   This will show you all installed packages in the environment.

This process will give you a clean environment with only the packages specified in your requirements.txt file.

Remember, if you're using conda-specific packages or want more control over the conda environment, you might want to consider using an 'environment.yml' file instead of 'requirements.txt'. The 'environment.yml' file is more suitable for conda environments and allows you to specify both conda and pip packages.
