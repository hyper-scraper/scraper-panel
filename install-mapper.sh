#!/bin/bash

cd node_modules
wget https://github.com/estliberitas/mapper/archive/master.zip
unzip -q master.zip
rm -rf mapper
mv mapper-master mapper
cd mapper
npm install .
cd .. && rm -rf ../master.zip