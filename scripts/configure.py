# Configure Postman for testing or production
import os
import os.path, time
import string
import json
import shutil
import PIL
from optparse import OptionParser
from datetime import datetime
from jinja2 import Environment, PackageLoader, Template

def generate_config_file(web_url):
	directory = os.path.dirname(os.path.realpath(__file__))
	config_template = open(directory + '/../extension/config_template.js')
	s = config_template.read()
	config_template.close()
	template = Template(s)

	if web_url == "production":
		app_id = 'POSTMAN_APP_ID_PRODUCTION'
	elif web_url == "staging":
		app_id = 'POSTMAN_APP_ID_STAGING'
	elif web_url == "dev":
		app_id = 'POSTMAN_APP_ID_DEV'
	elif web_url == "syncstage":
		app_id = 'POSTMAN_APP_ID_SYNCSTAGE'
	else:		
		app_id = 'POSTMAN_APP_ID_LOCAL'

	config_file = open(directory + "/../extension/config.js", "w")
	config_file.write(template.render(app_id=app_id))
	config_file.close()

def main():
    parser = OptionParser(usage="Usage: %prog [options] filename")    
    parser.add_option("-u", "--web_url", dest="web_url", help="(production/staging/dev/syncstage/local)")    

    (options, args) = parser.parse_args()

    web_url = options.web_url

    generate_config_file(web_url)    


if __name__ == "__main__":
    main()