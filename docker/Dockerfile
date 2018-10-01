FROM amazonlinux:2018.03

RUN yum update -y
RUN yum install -y tar gzip git
RUN yum groupinstall 'Development Tools' -y

RUN curl --silent --location https://rpm.nodesource.com/setup_8.x | bash -
RUN yum -y install nodejs gcc-c++ make
RUN npm install -g runjs node-gyp node-pre-gyp
RUN npm install -g https://github.com/fromkeith/runlam.git#64e4ee3dca6f3bd0cd165181dbed2b731234d1c1

