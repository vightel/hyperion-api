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


# Platform as a Service (Paas) with Docker / CONVOX

We are using CONVOX for deployment to AWS and Docker containers

## Docker Deployment using Convox
$ convox login console.convox.com
$ convox apps create

## Start locally
convox start

## Stop locally
docker ps
docker stop <ID>
	
## Deploy to AWS
convox deploy

### scaling
$ convox scale web --count=2
$ convox scale ipfs --count=1
// $ convox rack scale --type=m3.large --count=4

#### Debugging
$ convox ps
$ convox exec <ID> bash
$ convox instances

## Checking/Cleaning docker images
> docker images

Clean Docker
> docker rm -v $(docker ps -a -q -f status=exited)

> docker rmi -f $(docker images | grep "<none>" | awk "{print \$3}")
	
> docker rmi $(docker images -f "dangling=true" -q)