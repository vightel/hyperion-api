## hyperion-api

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

This is an express implementation of hyperion-api.
 
### Installation

Make sure you have an instance of Elasticsearch running. 
To populate with Hyperion data, make sure you have a Hyperion.csv file
[hyperion-metadata](https://github.com/vightel/hyperion-metadata) and 

To populate it with Landsat and Sentinel metadata refer to [landsat8-metadata](https://github.com/sat-utils/landsat8-metadata) and [sentinel2-metadata](https://github.com/sat-utils/sentinel2-metadata)

    $ npm install
    $ node app/index.js

### Environment Variables
ES_HOST
ES_PORT
NAME
WEBSITE

### About
Hyperion-api was tweaked by Pat Cappelaere for NASA GSFC
Original Sat API Express was made by [Development Seed](http://developmentseed.org).
