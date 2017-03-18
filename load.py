#
# Load EO-1 scenes in IPFS server
#

import os, subprocess, json, requests, sys, boto3, click
import ipfsapi
sys.path.append('../hyperion-l1u')
import config

eo1_scenes 		= []
scene_file_list = "scenes.txt"
ipfs_data		= None
ipfs_api		= None

s3_bucket 				= os.environ['BUCKETNAME']
#aws_access_key 		= os.environ.get('AWS_ACCESSKEYID')
#aws_secret_access_key 	= os.environ.get('AWS_SECRETACCESSKEY')

s3 = boto3.resource('s3')

#
# Find scenes of interest to load from data file
#
def load_scenes():
	file = open(scene_file_list, "r")
	for line in file:
		if line[0] != '#':
			eo1_scenes.append(line.strip())
			
	print eo1_scenes
	
#
# Check id scene is already loaded in IPFS
#
def ipfs_scene_exists(scene):
	global ipfs_api
	
	try:
		stat = ipfs_api.files_ls("/"+scene)
		return 1
	except:
		#e = sys.exc_info()[0]
		#print "Exception", scene, e
		return 0

def get_file_url(name):
	url = "https://s3.amazonaws.com/"+s3_bucket+"/"+name
	return url
	
#
# Create dir and parents if does not exist
#
def ipfs_mkdir(ipfs_dir):
	print "ipfs_mkdir", ipfs_dir
	try:
		ls 	 = ipfs_api.files_ls(ipfs_dir)
	except:
		# does not exist, them mkdir
		#print "mkdir", ipfs_dir
		ipfs_api.files_mkdir(ipfs_dir, parents=True)

def get_file_hash(myfile):
	print "add hash", myfile
	#payload = {'arg': myfile, 'only-hash': 1}
	#url = 'http://127.0.0.1:5001/api/v0/add'
	#r = requests.get(url, params=payload)
	#print r.url
	#print r.text
	cmd 	= "ipfs add -n " + myfile
	p 		= subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout.read()
	
	arr 	=  p.split('\r')
	hash 	= arr[len(arr)-1].split(' ')[1]
	return hash
		
def store_url(url, filepath):
	print "store from url", url
	r = requests.get(url, stream=True)
	if r.status_code == 200:
	    with open(filepath, 'wb') as f:
			for chunk in r.iter_content(chunk_size=1024):
				if chunk:
					f.write(chunk)
	else:
		print "Could not open url", r.status_code
	
	print "Done writing", filepath
	r.close()
	
def check_scene(scene):
	global ipfs_api
	bucket 		= s3.Bucket(s3_bucket)
	year		= scene[10:14]
	doy		    = scene[14:17]
	
	for obj in bucket.objects.filter(Prefix="L1U/{0}/{1}/{2}".format(year, doy,scene)):
		name	= obj.key
		#print get_file_url(name)
		#print name
		if not ipfs_scene_exists(name):
			# Check if it is on the local repo
			mydir 			= config.DATA_DIR
			basename		= os.path.basename(name)
			filepath		= os.path.join(mydir, "L1U", year, doy, scene+"_L1U", basename)
			ipfs_dir 		= "/L1U/{0}/{1}/{2}".format(year, doy,scene)
			ipfs_filepath 	= os.path.join(ipfs_dir,basename)

			if os.path.exists(filepath):
				# make ipfs directory if it does not exist
				ipfs_mkdir(ipfs_dir)
					
				# get the file hash
				hash = get_file_hash(filepath)
				
				# Add it to ipfs unix
				print "cp", hash, ipfs_filepath
				ipfs_api.files_cp("/ipfs/"+hash, ipfs_filepath)

			else:
				print "file does not exists", filepath
				file_dir	= os.path.dirname(filepath)
				if not os.path.exists(file_dir):
					print "making file_dir", file_dir
					os.makedirs(file_dir)
					
				# We need to load it from S3
				url 		= get_file_url(name)
				store_url(url, filepath)
					
				# Now we can do a straight add file and cp it
				# make sure IPFS dir exists
				ipfs_mkdir(ipfs_dir)
				
				print "Add to IPFS", filepath
				add_result = ipfs_api.add(filepath)
				hash = add_result['Hash']
				print "cp", hash, ipfs_filepath
				ipfs_api.files_cp("/ipfs/"+hash, ipfs_filepath)
	
		else:
			print "ipfs scene exists", name
		
def connect_to_ipfs():
	global ipfs_api
	
	ipfs_api 	= ipfsapi.connect('127.0.0.1', 5001)
	ipfs_id 	= ipfs_api.id()
	# print ipfs_id
		
@click.command()
@click.option('-a', '--all', is_flag=True, help='All scenes')
@click.option('--scene', 	default=None, help='Specific scene to load')
@click.option('-v', '--verbose', is_flag=True)

def main(all, scene, verbose):
	connect_to_ipfs()
	
	if all:
		#check_ipfs()
		load_scenes()
		for scene in eo1_scenes:
			check_scene(scene)
	else:
		check_scene(scene)
		
if __name__ == '__main__':
	main()

		
	
	