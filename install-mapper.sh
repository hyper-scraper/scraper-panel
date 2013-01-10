#!/bin/bash

cd node_modules
wget https://github.com/estliberitas/phantom-proxy/archive/master.zip
unzip -q master.zip
rm -rf phantom-proxy
mv phantom-proxy-master phantom-proxy
cd phantom-proxy
npm install .
cd .. && rm -rf master.zip

wget https://github.com/estliberitas/mapper/archive/master.zip
unzip -q master.zip
rm -rf mapper
mv mapper-master mapper
cd mapper
npm install .
cd .. && rm -rf ../master.zip