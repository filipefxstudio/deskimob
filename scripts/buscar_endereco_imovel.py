"""Test script - will be updated after investigation"""
import requests
from urllib.parse import urlparse

url = "https://www.imobee.net/imoveis/codigos/"
# First let's find a real listing URL
resp = requests.get("https://www.imobee.net/", timeout=15)
print("Home status:", resp.status_code)

# Try to find listing links
import re
links = re.findall(r'href="(/imoveis/[^"]+)"', resp.text)
print("Sample links:", links[:5])
