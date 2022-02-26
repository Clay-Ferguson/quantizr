# Kubernetes Notes

This doc should contain all the relevant info about how to run (at least the DEV environment) in minikube rather than on the host.
(NOTE: This is a work in progress and Quanta is not YET capable of deploying to K8)


Run `k8-start-minikube.sh` first to boot minikube.

To run a development instance (the only kind we currently have scripting/configs for, in this project) run script named `k8-start-dev.sh` and then also in a *separate terminal* run `minikube tunnel`

# See also:

https://minikube.sigs.k8s.io/docs/handbook/accessing/

# Tips

## Login to minikube with

    minikube ssh
    (Then to check images while in shell: `docker images`)

## Setup docker to build into to minikube images

    eval $(minikube docker-env)

if you need to reverse that in the same script do the following, which is not normally needed because simply re-running a script file again resets this. That is, the change is local to the terminal/script it appears.

    eval $(minikube docker-env -u)

https://medium.com/bb-tutorials-and-thoughts/how-to-use-own-local-doker-images-with-minikube-2c1ed0b0968