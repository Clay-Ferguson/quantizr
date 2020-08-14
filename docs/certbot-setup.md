# This is the script I ran on my linode instance of quanta.wiki to setup HTTPS certificate using "Let's Encrypt" certbot.

==========================================================
# BEGIN commands in August 2020 

From here (done on quantize.com instance)

https://www.digitalocean.com/community/tutorials/how-to-secure-apache-with-let-s-encrypt-on-ubuntu-20-04

Do all basic server setup first, including 'clay' user, firewall, etc.

# Install Apache (needed for certbot)

https://www.digitalocean.com/community/tutorials/how-to-install-the-apache-web-server-on-ubuntu-20-04

    sudo apt update
    sudo apt install apache2
    sudo ufw app list

output of above will be:
Available applications:
  Apache
  Apache Full
  Apache Secure
  OpenSSH

    sudo ufw allow 'Apache'
    sudo ufw status

### Make sure Apache running
    sudo systemctl status apache2
    ('q' key to get out of that)

    should be able to visit: http://quantizr.com and see the Apache server page there.

    Here's another nifty way to check what your IP is: 

    curl -4 icanhazip.com

### Managing Apache Server process:
  (fyi, don't RUN these necessarily)

To stop your web server, type:
    sudo systemctl stop apache2

To start the web server when it is stopped, type:
    sudo systemctl start apache2

To stop and then start the service again, type:
    sudo systemctl restart apache2

By default, Apache is configured to start automatically when the server boots. If this is not what you want, disable this behavior by typing:
    sudo systemctl disable apache2

To re-enable the service to start up at boot, type:
    sudo systemctl enable apache2

### Setting Up Virtual Hosts (Recommended)

    sudo mkdir /var/www/quantizr.com
    sudo chown -R $USER:$USER /var/www/quantizr.com
    sudo chmod -R 755 /var/www/quantizr.com

### Create default HTML file to serve:

    sudo nano /var/www/quantizr.com/index.html

    paste in this maybe:
    <html>
    <head>
        <title>Welcome to Your_domain!</title>
    </head>
    <body>
        <h1>Success!  The your_domain virtual host is working!</h1>
    </body>
    </html>

### Configure server to host new config:

   sudo nano /etc/apache2/sites-available/quantizr.com.conf

   paste in:
   <VirtualHost *:80>
    ServerAdmin webmaster@localhost
    ServerName your_domain
    ServerAlias www.your_domain
    DocumentRoot /var/www/your_domain
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
    </VirtualHost>

  enable new conf:
    sudo a2ensite quantizr.com.conf
  disable old conf:
    sudo a2dissite 000-default.conf
  check it:
    sudo apache2ctl configtest

### Restart Apache Service

    sudo systemctl restart apache2

### FINALLY server itself is ready for Certbot commands:

    sudo apt install certbot python3-certbot-apache

    If you just installed all the above initial setup this will be redundant but to check your config do this:

    check domain names in this:
       sudo nano /etc/apache2/sites-available/quantizr.com.conf

   test like this:
      sudo apache2ctl configtest

   Only if you found typos in the previous couple of commands (conf file edit) you would need to restart Apache like this:

      sudo systemctl reload apache2

### Now Second set of FIREWALL tweaks:

   sudo ufw status
   sudo ufw allow 'Apache Full'
   sudo ufw delete allow 'Apache'

   run this status again to see that 'Apache' one is gone and 'Apache Full' is in there (FULL one has https support)
   sudo ufw status

### Finally Certbot!

    sudo certbot --apache

    That command walks you thru the entire process.

### Export 

# The above commands, generate the PEM files, but SpringBoot needs a "p12" file, so we run this command to generate the
# p12 file
# 
# Note: When this prompts you for a password enter the same one you have in start.sh in the 'server.ssl.key-store-password' property
# Note: After running this REBOOT the server. It (apache2) will be sitting on port 80 and 443, but don't try to shut it down to fix that, instead REBOOT!
# Note: Note that the following should also be a volume line in the prod yaml file:
#        - '/etc/letsencrypt/live/quanta.wiki:/letsencrypt'

su -s (or su -) ...whichever works
cd /etc/letsencrypt/live/quanta.wiki
openssl pkcs12 -export -in fullchain.pem -inkey privkey.pem -out keystore.p12 -name tomcat -CAfile chain.pem -caname root

(when this prompts with export password a blank works, leave blank)

# -----------------------------
# Renewal
# -----------------------------
# Certbot certificates only last 3 months or so (I think) and here's how to renew

# First shutdown the WebApp, because certbot needs to use the same ports, 
# then run the rewnew command like this: 

Step 1:
   sudo certbot renew -v --force-renew --apache
Step 2:
   then after that run the openssl export command above, again!
   Warning: If you export the key using the command above and go with the 'no password' option then you should 
   also be sure that the 'secrets.sh' has this line 'export prodKeyStorePassword='
Step 3:
   and then reboot.
   
# Tips:
# If you have trouble getting into live folder do this:
#    sudo chmod 755 /etc/letsencrypt/live/

# END commands in August 2020
==========================================================

The rest of this file below this line contains just an assortment of older notes no longer needed.
===========================================================

# show commands as they are run.
set -x

# tip (command to check what ports are opened)
sudo lsof -i -P -n | grep LISTEN

# tip: If apache is still running after you try to stop keep running this until the above shows the ports no longer in use:
pgrep apache2 | xargs kill -9 

# Setup Firewall (from scratch)

* We must open up ports 80+443 (http+https) and also be sure NOT to have anything running on those ports, and so first shutdiwn any apache2 running

sudo service apache2 stop
systemctl status apache2.service

(hit 'q' to exit out of that one)

# at the time we run the certbot script below. Certbox does a conversation with another server and your server (to validate you)
# and it wants to be on these ports when doing that, so they must be free, at least when you run this certbot stuff below.
sudo apt install ufw
sudo systemctl start ufw 
sudo systemctl enable ufw
sudo ufw allow http
sudo ufw allow https
sudo ufw allow ssh
sudo ufw enable

# =================================================================================

# Be sure to shutdown any server running on port 80 (because certbot needs it) and then
# run the following commands.

# WARNING WARNING: The following letsencrypt-auto command appears to be not needed for renewals at least,
# because when i was renewing i discoved the above' certbot --apache' command seems to have 
# taken care of EVERYTHING AUTOMATICALLY (except for the pkcs12 conversion below). However when setting up brand new
# this command will be necessary???:

cd /etc/letsencrypt
sudo -H ./letsencrypt-auto certonly --standalone -d quanta.wiki

# We need to be root to get over to /etc/letsencrypt/live/quanta.wiki
su -s
# (for some reason now 'su -' works and 'su -s' doesn't it seems)

# WARNING: 
#After running the above 'apache2' will have hijacked ports 80 and 443 EVEN after a reboot, but here's how to kill it:

# kill it:
sudo /etc/init.d/apache2 stop

# verify it's dead:
sudo netstat -tulpn | grep LISTEN




