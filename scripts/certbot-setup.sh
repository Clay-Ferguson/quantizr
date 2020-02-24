#!/bin/bash

# This is the script I ran on my linode instance of quantizr.com to setup HTTPS certificate using "Let's Encrypt" certbot.

# show commands as they are run.
set -x

#tip (command to check what ports are opened)
sudo lsof -i -P -n | grep LISTEN

#tip: If apache is still running after you try to stop keep running this until the above shows the ports no longer in use:
pgrep apache2 | xargs kill -9 

# Setup Firewall (from scratch)
# We must open up ports 80+443 (http+https) and also be sure NOT to have anything running on those ports, and so first shutdiwn any apache2 running
sudo service apache2 stop
systemctl status apache2.service
# (hit 'q' to exit out of that one)

# at the time we run the certbot script below. Certbox does a conversation with another server and your server (to validate you)
# and it wants to be on these ports when doing that, so they must be free, at least when you run this certbot stuff below.
sudo apt install ufw
sudo systemctl start ufw && sudo systemctl enable ufw
sudo ufw allow http
sudo ufw allow https
sudo ufw allow ssh
sudo ufw enable

# Install Certbot
sudo apt-get update
sudo apt-get install software-properties-common
sudo add-apt-repository ppa:certbot/certbot
sudo apt-get update
sudo apt-get install python-certbot-apache
sudo apt-get update
sudo certbot --apache

# Setting up new Certificate

# Be sure to shutdown any server running on port 80 (because certbot needs it) and then
# run the following command.
#
# WARNING WARNING: The following letsencrypt-auto command appears to be not needed for renewals at least,
# because when i was renewing i discoved the above' certbot --apache' command seems to have 
# taken care of EVERYTHING AUTOMATICALLY (except for the pkcs12 conversion below). However when setting up brand new
# this command will be necessary???:
#
cd /etc/letsencrypt
sudo -H ./letsencrypt-auto certonly --standalone -d quantizr.com -d www.quantizr.com

# We need to be root to get over to /etc/letsencrypt/live/quantizr.com
su -s
# (for some reason now 'su -' works and 'su -s' doesn't it seems)

# The above commands, generate the PEM files, but SpringBoot needs a "p12" file, so we run this command to generate the
# p12 file

# Note1: I think maybe this openssl command ALSO needs to be run as root, so do 'su -' or 'su -s' before running it.
# Note2: When this prompts you for a password enter the same one you have in start.sh in the 'server.ssl.key-store-password' property
# Note3: After running this REBOOT the server. It (apache2) will be sitting on port 80 and 443, but don't try to shut it down to fix that, instead REBOOT!
# Note4: Also check this line in your 'start.sh' script "-v /etc/letsencrypt/live/quantizr.com:/letsencrypt \" because you may need to add an "-0002", to that
#        whenever the letsencrypt had added that. It usually DOES increment an 000X number each time on that folder every time you run 'certbot'

cd /etc/letsencrypt/live/quantizr.com
openssl pkcs12 -export -in fullchain.pem -inkey privkey.pem -out keystore.p12 -name tomcat -CAfile chain.pem -caname root

(when this prompts with export password a blank works, leave blank)

# WARNING: 
#After running the above 'apache2' will have hijacked ports 80 and 443 EVEN after a reboot, but here's how to kill it:

# kill it:
sudo /etc/init.d/apache2 stop

# verify it's dead:
sudo netstat -tulpn | grep LISTEN

# Renewal
# Certbot certificates only last 3 months or so (I think) and here's how to renew

# First shutdown the WebApp, because certbot needs to use the same ports, 
# then run the rewnew command like this: 

   sudo certbot renew
   
# Tips:
# If you have trouble getting into live folder do this:
#    sudo chmod 755 /etc/letsencrypt/live/

read -p "done. Press any key"
