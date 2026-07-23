#!/bin/sh
set -e

sudo mkdir -p /etc/opt/chrome/policies/managed

echo '{
  "ExtensionInstallForcelist": [
    "mhanihkoenmikcillkfniakbcdbkcelg;https://raw.githubusercontent.com/anwarulmaarif/resiqrbackup/main/update.xml"
  ]
}' | sudo tee /etc/opt/chrome/policies/managed/resiqrbackup.json > /dev/null

echo "Policy berhasil ditulis ke /etc/opt/chrome/policies/managed/resiqrbackup.json"
echo "Restart Chrome (pkill chrome) di PC ini agar policy terbaca."