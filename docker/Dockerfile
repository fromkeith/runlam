FROM amazonlinux:2018.03

RUN yum update -y
RUN yum install -y tar gzip git
RUN yum groupinstall 'Development Tools' -y

RUN curl --silent --location https://rpm.nodesource.com/setup_8.x | bash -
RUN yum -y install nodejs gcc-c++ make
RUN npm install -g runjs https://github.com/fromkeith/runlam.git node-gyp node-pre-gyp

