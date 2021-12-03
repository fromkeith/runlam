FROM amazonlinux:2

RUN yum update -y
RUN yum install -y tar gzip git
RUN yum groupinstall 'Development Tools' -y

RUN curl --silent --location https://rpm.nodesource.com/setup_12.x | bash -
RUN yum -y install nodejs gcc-c++ make
RUN npm install -g runjs node-gyp node-pre-gyp
RUN npm install -g https://github.com/fromkeith/runlam.git#15fb3b0bf4777f679032ea520ef8889c7e8138dc

