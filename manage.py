import os
import sys

profiles = {
    "bot": ("confess", "worker"),
    "web": ("confess-web", "web")
}

def invalidProfile():
    raise Exception(f'Invalid profile. Choose: {", ".join(profiles.keys())}')

if len(sys.argv) < 2:
    invalidProfile()

profileName = sys.argv[1].lower()

if profileName not in profiles:
    invalidProfile()

target, extension = profiles[profileName]
cmd = f"docker build -t {target} -f ./Dockerfile.{extension} ."

print("Running:", cmd)
os.system(cmd)