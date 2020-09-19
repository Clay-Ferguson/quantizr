## Certbot

It's recommended to use Certbot to setup HTTPS for a Quanta instance.

If you already know how to setup HTTPS on your server, you won't need the following. This is only provided as an additional resource for developers who may be setting up certbot for the first time.

Another resource: 

https://www.digitalocean.com/community/tutorials/how-to-secure-apache-with-let-s-encrypt-on-ubuntu-20-04

## Steps for setting up Certbot

```
sudo apt update
sudo apt install apache2
sudo ufw app list
```

output of above will be:

```
Available applications:
  Apache
  Apache Full
  Apache Secure
  OpenSSH
```

```
sudo ufw allow 'Apache'
sudo ufw status
```

### Make sure Apache running

    sudo systemctl status apache2

('q' key to get out of that)

Should be able to visit: http://quantizr.com and see the Apache server page there.

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

enter some content like this:

```html
<html>
    <head>
        <title>Welcome to Your_domain!</title>
    </head>
    <body>
        <h1>Success!  The your_domain virtual host is working!</h1>
    </body>
</html>
```

### Configure server to host new config:

   sudo nano /etc/apache2/sites-available/quantizr.com.conf

paste in:

```xml
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    ServerName your_domain
    ServerAlias www.your_domain
    DocumentRoot /var/www/your_domain
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

  enable new conf:

    sudo a2ensite quantizr.com.conf

  disable old conf:

    sudo a2dissite 000-default.conf

  check it:

    sudo apache2ctl configtest

### Restart Apache Service

    sudo systemctl restart apache2

### Now server itself is ready for Certbot commands:

    sudo apt install certbot python3-certbot-apache

If you just installed all the above initial setup this will be redundant but to check your config do this:

check domain names in this:

    sudo nano /etc/apache2/sites-available/quantizr.com.conf

test like this:

    sudo apache2ctl configtest

Only if you found typos in the previous couple of commands (conf file edit) you would need to restart Apache like this:

    sudo systemctl reload apache2

### Second set of FIREWALL tweaks:

    sudo ufw status
    sudo ufw allow 'Apache Full'
    sudo ufw delete allow 'Apache'

run this status again to see that 'Apache' one is gone and 'Apache Full' is in there (FULL one has https support)

    sudo ufw status

### Finally Certbot!

    sudo certbot --apache

That command walks you thru the entire process.

### Export 

The above commands, generate the PEM files, but SpringBoot needs a "p12" file, so we run this command to generate the p12 file

Note: When this prompts you for a password enter the same one you have in start.sh in the 'server.ssl.key-store-password' property

Note: After running this REBOOT the server. It (apache2) will be sitting on port 80 and 443, but don't try to shut it down to fix that, instead REBOOT!

Note: Note that the following should also be a volume line in the prod yaml file:

    - '/etc/letsencrypt/live/quanta.wiki:/letsencrypt'

```
su -s (or su -) ...whichever works
cd /etc/letsencrypt/live/quanta.wiki
openssl pkcs12 -export -in fullchain.pem -inkey privkey.pem -out keystore.p12 -name tomcat -CAfile chain.pem -caname root
```

(when this prompts with export password a blank works, leave blank)

## Renewal

Certbot certificates only last 3 months or so (I think) and here's how to renew

First shutdown the WebApp, because certbot needs to use the same ports, 
then run the rewnew command like this: 

### Step 1:

    sudo certbot renew -v --force-renew --apache

### Step 2:

Then after that run the openssl export command above, again!

Warning: If you export the key using the command above and go with the 'no password' option then you should also be sure that the 'secrets.sh' has this line `export prodKeyStorePassword=`

### Step 3:

and then reboot.

## Tips:

If you have trouble getting into live folder do this:

    sudo chmod 755 /etc/letsencrypt/live/

