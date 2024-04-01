FROM amazonlinux:2023

RUN yum update -y
RUN yum install -y tar gzip git
RUN yum groupinstall 'Development Tools' -y

RUN curl --silent --location https://rpm.nodesource.com/setup_20.x | bash -
RUN yum -y install nodejs gcc-c++ make
RUN npm install -g npm
RUN npm install -g runjs node-gyp node-pre-gyp github:fromkeith/runlam

